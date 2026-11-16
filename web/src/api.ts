export type Provider = "anthropic" | "openai" | "google" | "other";

export interface SyncStatus {
  running: boolean;
  lastSyncAt: string | null;
  lastSyncedDate: string | null;
  lastError: string | null;
}

export interface AgentInfo {
  agent: string;
  label: string;
}

export interface UsageResponse {
  range: { from: string; to: string };
  totals: {
    cost: number;
    tokens: number;
    input: number;
    output: number;
    cacheWrite: number;
    cacheRead: number;
    sessions: number;
    cacheSavings: number;
    activeDays: number;
  };
  costByType: { input: number; output: number; cacheWrite: number; cacheRead: number };
  agents: (AgentInfo & {
    cost: number;
    tokens: number;
    sessions: number;
    costShare: number;
    tokenShare: number;
  })[];
  models: {
    model: string;
    provider: Provider;
    agents: string[];
    cost: number;
    tokens: number;
    input: number;
    output: number;
    cacheWrite: number;
    cacheRead: number;
    costShare: number;
    tokenShare: number;
  }[];
  daily: {
    date: string;
    cost: number;
    tokens: number;
    input: number;
    output: number;
    cacheWrite: number;
    cacheRead: number;
    agents: Record<string, { cost: number; tokens: number }>;
  }[];
  sync: SyncStatus;
  firstDate: string | null;
  lastDate: string | null;
  allAgents: AgentInfo[];
}

/** `from` is a YYYY-MM-DD date, or "all" for the whole history. */
export async function fetchUsage(params: { from: string; to: string; agents: string[] }): Promise<UsageResponse> {
  const q = new URLSearchParams({ from: params.from, to: params.to });
  if (params.agents.length) q.set("agents", params.agents.join(","));
  const res = await fetch(`/api/usage?${q}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function triggerSync(full = false): Promise<SyncStatus> {
  const res = await fetch(`/api/sync${full ? "?full=1" : ""}`, { method: "POST" });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error ?? `Sync ${res.status}`);
  return json.sync;
}
