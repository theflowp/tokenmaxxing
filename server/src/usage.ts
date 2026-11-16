import { db } from "./db.js";
import { eachDay } from "./dates.js";

type Provider = "anthropic" | "openai" | "google" | "other";

const AGENT_LABELS: Record<string, string> = {
  claude: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  gemini: "Gemini CLI",
  amp: "Amp",
  copilot: "Copilot CLI",
  droid: "Droid",
  qwen: "Qwen Code",
  kimi: "Kimi",
  goose: "Goose",
  kilo: "Kilo",
  pi: "pi-agent",
};

export const agentLabel = (agent: string) => AGENT_LABELS[agent] ?? agent.charAt(0).toUpperCase() + agent.slice(1);

export function modelProvider(model: string): Provider {
  const m = model.toLowerCase();
  if (m.includes("claude") || m.includes("anthropic")) return "anthropic";
  if (/(^|\/)(gpt|o\d|codex|openai)/.test(m)) return "openai";
  if (m.includes("gemini")) return "google";
  return "other";
}

/**
 * Price of each token type relative to the uncached input price. ccusage only
 * gives one cost per model, so the split by type is an estimate from these ratios.
 */
const PRICE_RATIOS: Record<Provider, { output: number; cacheWrite: number; cacheRead: number }> = {
  anthropic: { output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  openai: { output: 8, cacheWrite: 1, cacheRead: 0.1 },
  google: { output: 8, cacheWrite: 1, cacheRead: 0.25 },
  other: { output: 4, cacheWrite: 1, cacheRead: 0.1 },
};

interface TokenCounts {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

interface Row extends TokenCounts {
  date: string;
  agent: string;
  model: string;
  cost: number;
}

const tokensOf = (r: TokenCounts) => r.input + r.output + r.cacheWrite + r.cacheRead;

function splitCost(model: string, r: TokenCounts & { cost: number }) {
  const k = PRICE_RATIOS[modelProvider(model)];
  const weighted = r.input + r.output * k.output + r.cacheWrite * k.cacheWrite + r.cacheRead * k.cacheRead;
  const unit = weighted > 0 ? r.cost / weighted : 0;
  return {
    input: r.input * unit,
    output: r.output * k.output * unit,
    cacheWrite: r.cacheWrite * k.cacheWrite * unit,
    cacheRead: r.cacheRead * k.cacheRead * unit,
    // What cache reads would have cost as fresh input.
    cacheSavings: r.cacheRead * (1 - k.cacheRead) * unit,
  };
}

const zeroCounts = (): TokenCounts & { cost: number; tokens: number } => ({
  input: 0,
  output: 0,
  cacheWrite: 0,
  cacheRead: 0,
  cost: 0,
  tokens: 0,
});

function addInto(target: TokenCounts & { cost: number; tokens: number }, r: Row) {
  target.input += r.input;
  target.output += r.output;
  target.cacheWrite += r.cacheWrite;
  target.cacheRead += r.cacheRead;
  target.cost += r.cost;
  target.tokens += tokensOf(r);
}

export function dataBounds() {
  const row = db.prepare("SELECT MIN(date) AS first, MAX(date) AS last FROM daily_model").get() as {
    first: string | null;
    last: string | null;
  };
  const agents = (db.prepare("SELECT DISTINCT agent FROM daily_model ORDER BY agent").all() as { agent: string }[]).map(
    (r) => ({ agent: r.agent, label: agentLabel(r.agent) }),
  );
  return { firstDate: row.first, lastDate: row.last, allAgents: agents };
}

export function usage(from: string, to: string, agents: string[] | null) {
  const agentFilter = agents?.length ? ` AND agent IN (${agents.map(() => "?").join(",")})` : "";
  const params = [from, to, ...(agents ?? [])];

  const rows = db
    .prepare(
      `SELECT date, agent, model, input, output, cache_write AS cacheWrite, cache_read AS cacheRead, cost
       FROM daily_model WHERE date >= ? AND date <= ?${agentFilter}`,
    )
    .all(...params) as unknown as Row[];

  const sessionRows = db
    .prepare(
      `SELECT agent, COUNT(*) AS n FROM sessions
       WHERE last_date >= ? AND first_date <= ?${agentFilter} GROUP BY agent`,
    )
    .all(from, to, ...(agents ?? [])) as { agent: string; n: number }[];
  const sessionsByAgent = new Map(sessionRows.map((r) => [r.agent, Number(r.n)]));

  const totals = zeroCounts();
  const costByType = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  let cacheSavings = 0;

  const byAgent = new Map<string, ReturnType<typeof zeroCounts>>();
  const byModel = new Map<string, ReturnType<typeof zeroCounts> & { agents: Set<string> }>();
  const byDay = new Map<
    string,
    ReturnType<typeof zeroCounts> & { agents: Record<string, { cost: number; tokens: number }> }
  >();

  for (const r of rows) {
    addInto(totals, r);

    const a = byAgent.get(r.agent) ?? zeroCounts();
    addInto(a, r);
    byAgent.set(r.agent, a);

    const m = byModel.get(r.model) ?? { ...zeroCounts(), agents: new Set<string>() };
    addInto(m, r);
    m.agents.add(r.agent);
    byModel.set(r.model, m);

    const d = byDay.get(r.date) ?? { ...zeroCounts(), agents: {} };
    addInto(d, r);
    const da = (d.agents[r.agent] ??= { cost: 0, tokens: 0 });
    da.cost += r.cost;
    da.tokens += tokensOf(r);
    byDay.set(r.date, d);
  }

  // Split cost by type per model (ratios differ by provider), then sum.
  for (const [model, m] of byModel) {
    const s = splitCost(model, m);
    costByType.input += s.input;
    costByType.output += s.output;
    costByType.cacheWrite += s.cacheWrite;
    costByType.cacheRead += s.cacheRead;
    cacheSavings += s.cacheSavings;
  }

  const share = (v: number, total: number) => (total > 0 ? v / total : 0);

  const agentList = [...byAgent.entries()]
    .map(([agent, a]) => ({
      agent,
      label: agentLabel(agent),
      cost: a.cost,
      tokens: a.tokens,
      sessions: sessionsByAgent.get(agent) ?? 0,
      costShare: share(a.cost, totals.cost),
      tokenShare: share(a.tokens, totals.tokens),
    }))
    .sort((x, y) => y.cost - x.cost || y.tokens - x.tokens);

  const models = [...byModel.entries()]
    .map(([model, m]) => ({
      model,
      provider: modelProvider(model),
      agents: [...m.agents],
      cost: m.cost,
      tokens: m.tokens,
      input: m.input,
      output: m.output,
      cacheWrite: m.cacheWrite,
      cacheRead: m.cacheRead,
      costShare: share(m.cost, totals.cost),
      tokenShare: share(m.tokens, totals.tokens),
    }))
    .sort((x, y) => y.cost - x.cost || y.tokens - x.tokens);

  const daily = eachDay(from, to).map((date) => {
    const d = byDay.get(date);
    return {
      date,
      cost: d?.cost ?? 0,
      tokens: d?.tokens ?? 0,
      input: d?.input ?? 0,
      output: d?.output ?? 0,
      cacheWrite: d?.cacheWrite ?? 0,
      cacheRead: d?.cacheRead ?? 0,
      agents: d?.agents ?? {},
    };
  });

  return {
    range: { from, to },
    totals: {
      ...totals,
      sessions: [...sessionsByAgent.values()].reduce((s, n) => s + n, 0),
      cacheSavings,
      activeDays: byDay.size,
    },
    costByType,
    agents: agentList,
    models,
    daily,
  };
}
