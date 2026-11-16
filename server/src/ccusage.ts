import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { CODEX_MIRROR } from "./codex-mirror.js";

const BIN = process.env.CCUSAGE_BIN ?? "ccusage";

export interface ModelBreakdown {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
}

export interface AgentRow {
  agent: string;
  modelBreakdowns: ModelBreakdown[];
}

export interface DailyRow {
  period: string; // YYYY-MM-DD
  agents?: AgentRow[];
  modelBreakdowns: ModelBreakdown[];
}

export interface SessionRow {
  agent: string;
  period: string; // session id
  metadata?: { lastActivity?: string };
  totalTokens: number;
  totalCost: number;
}

function run(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      BIN,
      [...args, "--json", "--no-color"],
      {
        maxBuffer: 512 * 1024 * 1024,
        // Point ccusage at the mirror that includes decompressed Codex logs.
        env: { ...process.env, NO_COLOR: "1", ...(existsSync(CODEX_MIRROR) ? { CODEX_HOME: CODEX_MIRROR } : {}) },
      },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`ccusage ${args.join(" ")} failed: ${stderr || err.message}`));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

export async function fetchDaily(since?: string): Promise<DailyRow[]> {
  const args = ["daily", "--by-agent"];
  if (since) args.push("--since", since);
  const json = JSON.parse(await run(args)) as { daily?: DailyRow[] };
  return json.daily ?? [];
}

export async function fetchSessions(since?: string): Promise<SessionRow[]> {
  const args = ["session"];
  if (since) args.push("--since", since);
  const json = JSON.parse(await run(args)) as { session?: SessionRow[]; sessions?: SessionRow[] };
  return json.session ?? json.sessions ?? [];
}
