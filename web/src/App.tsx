import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, SegmentedControl, Skeleton, Tooltip } from "@lenso/ui";
import { Select } from "@lenso/ui/select";
import { fetchUsage, triggerSync, type UsageResponse } from "./api";
import { agentColor } from "./agents";
import { DailyChart, type Metric } from "./components/DailyChart";
import { StackBar, type Segment } from "./components/StackBar";
import { Breakdown } from "./components/Breakdown";
import { addDays, ago, integer, localDate, money, percent, tokens } from "./format";

type Range = "7" | "30" | "90" | "all";

const RANGES = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
  { value: "all", label: "Tout" },
] as const;

const METRICS = [
  { value: "cost", label: "Coût" },
  { value: "tokens", label: "Tokens" },
] as const;

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
    const t = setTimeout(() => setReloadKey((k) => k + 1), 2000);
    return () => clearTimeout(t);
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

  const agentItems = useMemo(
    () => [
      { value: "all", label: "Tous les agents" },
      ...(data?.allAgents ?? []).map((a) => ({ value: a.agent, label: a.label })),
    ],
    [data?.allAgents],
  );

  const isSyncing = syncing || serverSyncing;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="crumbs">
            <span className="brand">Tokenmaxxing</span>
            <span className="sep">/</span>
            <Select items={agentItems} value={agent} onValueChange={(v) => v && setAgent(v)} variant="secondary">
              <Select.Trigger aria-label="Agent">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Content>
                <Select.List>
                  {agentItems.map((item) => (
                    <Select.Item key={item.value} value={item.value} label={item.label}>
                      <Select.ItemText>{item.label}</Select.ItemText>
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </Select.List>
              </Select.Content>
            </Select>
          </div>
          <div className="controls">
            <SegmentedControl
              size="sm"
              items={RANGES}
              value={range}
              onValueChange={(v) => v && setRange(v as Range)}
              aria-label="Période"
            />
            <SegmentedControl
              size="sm"
              items={METRICS}
              value={metric}
              onValueChange={(v) => v && setMetric(v as Metric)}
              aria-label="Mesure"
            />
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <Button
                    variant="borderless"
                    size="sm"
                    isIconOnly
                    aria-label="Synchroniser avec ccusage"
                    onClick={onSync}
                    disabled={isSyncing}
                    icon={<RefreshIcon spinning={isSyncing} />}
                  />
                }
              />
              <Tooltip.Content>
                {isSyncing ? "Synchronisation…" : `Dernière synchro ${ago(data?.sync.lastSyncAt ?? null)}`}
              </Tooltip.Content>
            </Tooltip>
          </div>
        </div>
      </header>

      <main className="page">
        {error && <div className="banner error">Erreur : {error}</div>}
        {data?.sync.lastError && <div className="banner error">Synchro ccusage en échec : {data.sync.lastError}</div>}

        {!data ? (
          <LoadingState />
        ) : data.totals.tokens === 0 && !data.lastDate ? (
          <div className="empty">
            {isSyncing
              ? "Première synchronisation avec ccusage en cours…"
              : "Aucune donnée. Lance une synchronisation."}
          </div>
        ) : (
          <Dashboard data={data} metric={metric} />
        )}

        <footer className="foot muted">
          {data && (
            <>
              Données locales via ccusage · synchro {ago(data.sync.lastSyncAt)}
              {data.firstDate && <> · historique depuis le {data.firstDate.split("-").reverse().join("/")}</>}
            </>
          )}
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
  const t = data.totals;
  const headline = metric === "cost" ? money(t.cost) : tokens(t.tokens);

  const typeSegments: Segment[] =
    metric === "cost"
      ? [
          {
            key: "in",
            label: "Input",
            value: data.costByType.input,
            color: "var(--seg-1)",
            display: money(data.costByType.input),
          },
          {
            key: "cr",
            label: "Lecture cache",
            value: data.costByType.cacheRead,
            color: "var(--seg-2)",
            display: money(data.costByType.cacheRead),
          },
          {
            key: "cw",
            label: "Écriture cache",
            value: data.costByType.cacheWrite,
            color: "var(--seg-3)",
            display: money(data.costByType.cacheWrite),
          },
          {
            key: "out",
            label: "Output",
            value: data.costByType.output,
            color: "var(--seg-4)",
            display: money(data.costByType.output),
          },
        ]
      : [
          { key: "in", label: "Input", value: t.input, color: "var(--seg-1)", display: tokens(t.input) },
          {
            key: "cr",
            label: "Lecture cache",
            value: t.cacheRead,
            color: "var(--seg-2)",
            display: tokens(t.cacheRead),
          },
          {
            key: "cw",
            label: "Écriture cache",
            value: t.cacheWrite,
            color: "var(--seg-3)",
            display: tokens(t.cacheWrite),
          },
          { key: "out", label: "Output", value: t.output, color: "var(--seg-4)", display: tokens(t.output) },
        ];

  const agentSegments: Segment[] = data.agents.map((a, i) => ({
    key: a.agent,
    label: a.label,
    value: a[metric],
    color: agentColor(a.agent, i),
    display: metric === "cost" ? money(a.cost) : tokens(a.tokens),
  }));

  return (
    <>
      <div className="grid-top">
        <div className="summary">
          <div className="headline">{headline}</div>
          <div className="sub muted">
            {integer(t.sessions)} sessions ·{" "}
            {metric === "cost" ? "estimation au prix API" : `${money(t.cost)} au prix API`}
          </div>

          <ul className="agents">
            {data.agents.map((a, i) => (
              <li key={a.agent}>
                <div className="agent-line">
                  <span className="dot" style={{ background: agentColor(a.agent, i) }} />
                  <span className="agent-name">{a.label}</span>
                  <span className="muted small">{integer(a.sessions)} sessions</span>
                  <span className="agent-value num">{metric === "cost" ? money(a.cost) : tokens(a.tokens)}</span>
                </div>
                <div className="muted small agent-meta">
                  {percent(metric === "cost" ? a.costShare : a.tokenShare)} du {metric === "cost" ? "coût" : "volume"} ·{" "}
                  {metric === "cost" ? `${tokens(a.tokens)} tokens` : money(a.cost)}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="chart-card">
          <h3 className="section-title">{metric === "cost" ? "Coût par jour" : "Tokens par jour"}</h3>
          <DailyChart data={data} metric={metric} />
        </div>
      </div>

      <section>
        <h3 className="section-title">Totaux</h3>
        <dl className="totals">
          {[
            ["Tokens traités", tokens(t.tokens)],
            ["Lecture cache", tokens(t.cacheRead)],
            ["Écriture cache", tokens(t.cacheWrite)],
            ["Input hors cache", tokens(t.input)],
            ["Output", tokens(t.output)],
            ["Économie du cache", money(t.cacheSavings)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid-2">
        <StackBar title={metric === "cost" ? "Coût par type (estimé)" : "Tokens par type"} segments={typeSegments} />
        <StackBar
          title={metric === "cost" ? "Coût par agent" : "Tokens par agent"}
          aside={`${integer(t.activeDays)} jours actifs`}
          segments={agentSegments}
        />
      </div>

      <Breakdown data={data} metric={metric} />
    </>
  );
}
