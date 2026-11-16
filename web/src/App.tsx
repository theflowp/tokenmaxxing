import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, SegmentedControl, Skeleton, Tooltip } from "@lenso/ui";
import { fetchUsage, triggerSync, type UsageResponse } from "./api";
import { agentColor } from "./agents";
import { DailyChart, type Metric } from "./components/DailyChart";
import { StackBar, type Segment } from "./components/StackBar";
import { Breakdown } from "./components/Breakdown";
import { Dropdown } from "./components/Dropdown";
import { addDays, localDate, secondsSince } from "./format";
import { LANGUAGES, useI18n } from "./i18n";

const REPO_URL = "https://github.com/theflowp/tokenmaxxing";

type Range = "7" | "30" | "90" | "all";

function usePersisted<T extends string>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      return (localStorage.getItem(key) as T | null) ?? initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, v);
      } catch {
        /* storage unavailable */
      }
    },
    [key],
  );
  return [value, set];
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={spinning ? "spin" : undefined} width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function App() {
  const { t, f, lang, setLang } = useI18n();
  const [range, setRange] = usePersisted<Range>("tm.range", "30");
  const [metric, setMetric] = usePersisted<Metric>("tm.metric", "cost");
  const [agent, setAgent] = usePersisted<string>("tm.agent", "all");
  const [data, setData] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Recomputed on every reload so a dashboard left open rolls over to the new day.
    const to = localDate();
    const from = range === "all" ? "all" : addDays(to, -(Number(range) - 1));
    fetchUsage({ from, to, agents: agent === "all" ? [] : [agent] })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [range, agent, reloadKey]);

  // The server syncs at startup and on a timer: poll while a sync is running.
  const serverSyncing = data?.sync.running ?? false;
  useEffect(() => {
    if (!serverSyncing) return;
    const timer = setTimeout(() => setReloadKey((k) => k + 1), 2000);
    return () => clearTimeout(timer);
  }, [serverSyncing, data]);

  const onSync = async () => {
    setSyncing(true);
    try {
      await triggerSync();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
      setReloadKey((k) => k + 1);
    }
  };

  const ranges = useMemo(
    () => [
      { value: "7" as const, label: t.days(7) },
      { value: "30" as const, label: t.days(30) },
      { value: "90" as const, label: t.days(90) },
      { value: "all" as const, label: t.allTime },
    ],
    [t],
  );

  const metrics = useMemo(
    () => [
      { value: "cost", label: t.cost },
      { value: "tokens", label: t.tokens },
    ],
    [t],
  );

  const agentItems = useMemo(
    () => [
      { value: "all", label: t.allAgents },
      ...(data?.allAgents ?? []).map((a) => ({ value: a.agent, label: a.label })),
    ],
    [data?.allAgents, t],
  );

  const isSyncing = syncing || serverSyncing;
  const lastSyncAt = data?.sync.lastSyncAt ?? null;
  const syncText = isSyncing
    ? t.syncing
    : !lastSyncAt
      ? t.neverSynced
      : secondsSince(lastSyncAt) < 60
        ? t.syncedJustNow
        : t.syncedAgo(f.ago(lastSyncAt));

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="crumbs">
            <span className="brand">Tokenmaxxing</span>
            <span className="sep">/</span>
            <Dropdown label={t.agent} items={agentItems} value={agent} onChange={setAgent} appearance="title" />
          </div>
          <div className="controls">
            <Dropdown label={t.period} items={ranges} value={range} onChange={setRange} />
            <SegmentedControl
              size="sm"
              items={metrics}
              value={metric}
              onValueChange={(v) => v && setMetric(v as Metric)}
              aria-label={t.metric}
            />
          </div>
        </div>
      </header>

      <main className="page">
        {error && <div className="banner error">{t.error(error)}</div>}
        {data?.sync.lastError && <div className="banner error">{t.syncFailed(data.sync.lastError)}</div>}

        {!data ? (
          <LoadingState />
        ) : data.totals.tokens === 0 && !data.lastDate ? (
          <div className="empty">{isSyncing ? t.firstSync : t.noData}</div>
        ) : (
          <Dashboard data={data} metric={metric} />
        )}

        <footer className="foot muted">
          <div className="foot-row">
            {data && (
              <span>
                {t.localData} · {syncText}
                {data.firstDate && <> · {t.historySince(f.dateMedium(data.firstDate))}</>}
              </span>
            )}
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <Button
                    variant="borderless"
                    size="sm"
                    isIconOnly
                    aria-label={t.syncAction}
                    onClick={onSync}
                    disabled={isSyncing}
                    icon={<RefreshIcon spinning={isSyncing} />}
                  />
                }
              />
              <Tooltip.Content>{isSyncing ? t.syncInProgress : t.syncNow}</Tooltip.Content>
            </Tooltip>
          </div>
          <div className="foot-row">
            <Dropdown label={t.language} items={LANGUAGES} value={lang} onChange={setLang} size="sm" />
            <span className="sep">·</span>
            <a className="foot-link" href={REPO_URL} target="_blank" rel="noreferrer">
              {t.sourceCode}
            </a>
          </div>
        </footer>
      </main>
    </>
  );
}

function LoadingState() {
  return (
    <div className="grid-top">
      <div>
        <Skeleton style={{ height: 44, width: 220, borderRadius: 8 }} />
        <Skeleton style={{ height: 14, width: 160, marginTop: 10, borderRadius: 4 }} />
      </div>
      <Skeleton style={{ height: 240, borderRadius: 12 }} />
    </div>
  );
}

function Dashboard({ data, metric }: { data: UsageResponse; metric: Metric }) {
  const { t, f } = useI18n();
  const totals = data.totals;
  const value = (cost: number, tokenCount: number) => (metric === "cost" ? f.money(cost) : f.tokens(tokenCount));

  const byType =
    metric === "cost"
      ? data.costByType
      : { input: totals.input, cacheRead: totals.cacheRead, cacheWrite: totals.cacheWrite, output: totals.output };
  const fmtType = metric === "cost" ? f.money : f.tokens;
  const typeSegments: Segment[] = [
    { key: "in", label: t.input, value: byType.input, color: "var(--seg-1)", display: fmtType(byType.input) },
    {
      key: "cr",
      label: t.cacheRead,
      value: byType.cacheRead,
      color: "var(--seg-2)",
      display: fmtType(byType.cacheRead),
    },
    {
      key: "cw",
      label: t.cacheWrite,
      value: byType.cacheWrite,
      color: "var(--seg-3)",
      display: fmtType(byType.cacheWrite),
    },
    { key: "out", label: t.output, value: byType.output, color: "var(--seg-4)", display: fmtType(byType.output) },
  ];

  const agentSegments: Segment[] = data.agents.map((a, i) => ({
    key: a.agent,
    label: a.label,
    value: a[metric],
    color: agentColor(a.agent, i),
    display: value(a.cost, a.tokens),
  }));

  return (
    <>
      <div className="grid-top">
        <div className="summary">
          <div className="headline">{value(totals.cost, totals.tokens)}</div>
          <div className="sub muted">
            {t.sessions(f.integer(totals.sessions))} ·{" "}
            {metric === "cost" ? t.apiEstimate : t.atApiPrice(f.money(totals.cost))}
          </div>

          <ul className="agents">
            {data.agents.map((a, i) => (
              <li key={a.agent}>
                <div className="agent-line">
                  <span className="dot" style={{ background: agentColor(a.agent, i) }} />
                  <span className="agent-name">{a.label}</span>
                  <span className="muted small">{t.sessions(f.integer(a.sessions))}</span>
                  <span className="agent-value num">{value(a.cost, a.tokens)}</span>
                </div>
                <div className="muted small agent-meta">
                  {metric === "cost"
                    ? `${t.shareOfCost(f.percent(a.costShare))} · ${t.tokenCount(f.tokens(a.tokens))}`
                    : `${t.shareOfVolume(f.percent(a.tokenShare))} · ${f.money(a.cost)}`}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="chart-card">
          <h3 className="section-title">{metric === "cost" ? t.costPerDay : t.tokensPerDay}</h3>
          <DailyChart data={data} metric={metric} />
        </div>
      </div>

      <section>
        <h3 className="section-title">{t.totals}</h3>
        <dl className="totals">
          {[
            [t.processedTokens, f.tokens(totals.tokens)],
            [t.cacheRead, f.tokens(totals.cacheRead)],
            [t.cacheWrite, f.tokens(totals.cacheWrite)],
            [t.uncachedInput, f.tokens(totals.input)],
            [t.output, f.tokens(totals.output)],
            [t.cacheSavings, f.money(totals.cacheSavings)],
          ].map(([label, v]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid-2">
        <StackBar title={metric === "cost" ? t.costByType : t.tokensByType} segments={typeSegments} />
        <StackBar
          title={metric === "cost" ? t.costByAgent : t.tokensByAgent}
          aside={t.activeDays(f.integer(totals.activeDays))}
          segments={agentSegments}
        />
      </div>

      <Breakdown data={data} metric={metric} />
    </>
  );
}
