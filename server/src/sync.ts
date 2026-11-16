import { db, getMeta, setMeta, transaction } from "./db.js";
import { fetchDaily, fetchSessions } from "./ccusage.js";
import { prepareCodexMirror, type MirrorStats } from "./codex-mirror.js";
import { addDays, localDate } from "./dates.js";

/**
 * Days re-fetched before the last synced day. The last day was usually still
 * in progress at sync time, and a margin covers sessions written late.
 */
const OVERLAP_DAYS = 1;

/**
 * Bump when the data source changes so stored history is rebuilt once.
 * 2: compressed Codex logs (.jsonl.zst) are now included.
 */
const DATA_VERSION = "2";

export interface SyncResult {
  since: string | null;
  days: number;
  rows: number;
  sessions: number;
  durationMs: number;
  lastSyncedDate: string;
  codex: MirrorStats;
}

export interface SyncStatus {
  running: boolean;
  lastSyncAt: string | null;
  lastSyncedDate: string | null;
  lastError: string | null;
  lastResult: SyncResult | null;
}

let running: Promise<SyncResult> | null = null;
let lastError: string | null = null;
let lastResult: SyncResult | null = null;

export function syncStatus(): SyncStatus {
  return {
    running: running !== null,
    lastSyncAt: getMeta("last_sync_at") ?? null,
    lastSyncedDate: getMeta("last_synced_date") ?? null,
    lastError,
    lastResult,
  };
}

/** Runs one sync at a time; concurrent callers share the same run. */
export function sync(opts: { full?: boolean } = {}): Promise<SyncResult> {
  if (!running) {
    running = doSync(opts.full ?? false)
      .then((r) => {
        lastError = null;
        lastResult = r;
        return r;
      })
      .catch((err: unknown) => {
        lastError = err instanceof Error ? err.message : String(err);
        throw err;
      })
      .finally(() => {
        running = null;
      });
  }
  return running;
}

async function doSync(full: boolean): Promise<SyncResult> {
  const started = Date.now();
  const rebuild = full || getMeta("data_version") !== DATA_VERSION;
  const lastSynced = rebuild ? undefined : getMeta("last_synced_date");
  const since = lastSynced ? addDays(lastSynced, -OVERLAP_DAYS) : null;

  const run = db
    .prepare("INSERT INTO sync_runs (started_at, since) VALUES (?, ?)")
    .run(new Date().toISOString(), since);
  const runId = Number(run.lastInsertRowid);

  try {
    const codex = await prepareCodexMirror();
    const [daily, sessions] = await Promise.all([fetchDaily(since ?? undefined), fetchSessions(since ?? undefined)]);

    let rows = 0;
    transaction(() => {
      // Days >= since are replaced wholesale: ccusage gives complete totals per day.
      if (since) db.prepare("DELETE FROM daily_model WHERE date >= ?").run(since);
      else db.exec("DELETE FROM daily_model");

      const insert = db.prepare(`
        INSERT INTO daily_model (date, agent, model, input, output, cache_write, cache_read, cost)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date, agent, model) DO UPDATE SET
          input = input + excluded.input,
          output = output + excluded.output,
          cache_write = cache_write + excluded.cache_write,
          cache_read = cache_read + excluded.cache_read,
          cost = cost + excluded.cost
      `);

      for (const day of daily) {
        const groups = day.agents?.length ? day.agents : [{ agent: "unknown", modelBreakdowns: day.modelBreakdowns }];
        for (const group of groups) {
          for (const m of group.modelBreakdowns ?? []) {
            insert.run(
              day.period,
              group.agent,
              m.modelName,
              m.inputTokens ?? 0,
              m.outputTokens ?? 0,
              m.cacheCreationTokens ?? 0,
              m.cacheReadTokens ?? 0,
              m.cost ?? 0,
            );
            rows++;
          }
        }
      }

      // With --since, a session that started earlier comes back with partial
      // totals, so keep the larger of the stored and fetched values.
      const upsertSession = db.prepare(`
        INSERT INTO sessions (agent, id, first_date, last_date, last_activity, tokens, cost)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(agent, id) DO UPDATE SET
          first_date = MIN(first_date, excluded.first_date),
          last_date = MAX(last_date, excluded.last_date),
          last_activity = MAX(last_activity, excluded.last_activity),
          tokens = MAX(tokens, excluded.tokens),
          cost = MAX(cost, excluded.cost)
      `);
      for (const s of sessions) {
        const activity = s.metadata?.lastActivity;
        if (!activity) continue;
        const date = localDate(new Date(activity));
        upsertSession.run(s.agent ?? "unknown", s.period, date, date, activity, s.totalTokens ?? 0, s.totalCost ?? 0);
      }
    });

    // Every day before today is now complete; today stays open and gets re-fetched next time.
    const lastSyncedDate = localDate();
    setMeta("last_synced_date", lastSyncedDate);
    setMeta("last_sync_at", new Date().toISOString());
    setMeta("data_version", DATA_VERSION);

    const durationMs = Date.now() - started;
    db.prepare("UPDATE sync_runs SET finished_at = ?, days = ?, sessions = ?, duration_ms = ? WHERE id = ?").run(
      new Date().toISOString(),
      daily.length,
      sessions.length,
      durationMs,
      runId,
    );

    return { since, days: daily.length, rows, sessions: sessions.length, durationMs, lastSyncedDate, codex };
  } catch (err) {
    db.prepare("UPDATE sync_runs SET finished_at = ?, error = ?, duration_ms = ? WHERE id = ?").run(
      new Date().toISOString(),
      err instanceof Error ? err.message : String(err),
      Date.now() - started,
      runId,
    );
    throw err;
  }
}
