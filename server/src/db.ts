import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.TOKENMAXXING_DB ?? resolve(here, "../data/usage.db");

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;

  -- One row per day x agent (claude, codex, opencode...) x model.
  CREATE TABLE IF NOT EXISTS daily_model (
    date         TEXT    NOT NULL,
    agent        TEXT    NOT NULL,
    model        TEXT    NOT NULL,
    input        INTEGER NOT NULL DEFAULT 0,
    output       INTEGER NOT NULL DEFAULT 0,
    cache_write  INTEGER NOT NULL DEFAULT 0,
    cache_read   INTEGER NOT NULL DEFAULT 0,
    cost         REAL    NOT NULL DEFAULT 0,
    PRIMARY KEY (date, agent, model)
  );

  -- Sessions are only used to count activity, keyed by agent + session id.
  CREATE TABLE IF NOT EXISTS sessions (
    agent         TEXT    NOT NULL,
    id            TEXT    NOT NULL,
    first_date    TEXT    NOT NULL,
    last_date     TEXT    NOT NULL,
    last_activity TEXT    NOT NULL,
    tokens        INTEGER NOT NULL DEFAULT 0,
    cost          REAL    NOT NULL DEFAULT 0,
    PRIMARY KEY (agent, id)
  );

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at  TEXT NOT NULL,
    finished_at TEXT,
    since       TEXT,
    days        INTEGER,
    sessions    INTEGER,
    duration_ms INTEGER,
    error       TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_last_date ON sessions (last_date);
`);

export function getMeta(key: string): string | undefined {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}

export function setMeta(key: string, value: string): void {
  db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    key,
    value,
  );
}

export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
