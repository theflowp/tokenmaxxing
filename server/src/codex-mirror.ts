/**
 * Codex compresses older session logs to `.jsonl.zst`, and ccusage only reads
 * plain `.jsonl`. This keeps a mirror of $CODEX_HOME that ccusage can read:
 * plain logs are symlinked, compressed ones are decompressed once, keeping only
 * the lines ccusage needs (about 30x smaller than the full log).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, mkdir, readdir, readlink, rename, rm, stat, symlink, unlink, utimes } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CODEX_SOURCE = process.env.CODEX_HOME ?? join(homedir(), ".codex");
export const CODEX_MIRROR = resolve(dirname(fileURLToPath(import.meta.url)), "../data/codex-home");

const LOG_DIRS = ["sessions", "archived_sessions"];
const LINKED_FILES = ["config.toml"]; // ccusage reads service_tier from it for pricing
const CONCURRENCY = 4;

// Lines ccusage uses: session metadata, model per turn and token counts.
const FILTER = `zstd -dcq -- "$1" | grep -E '"type":"(session_meta|turn_context|token_usage_record|event_msg)"' | grep -v '"type":"item_completed"' > "$2"; s=$?; [ $s -le 1 ]`;

export interface MirrorStats {
  decompressed: number;
  linked: number;
  removed: number;
  skipped: boolean;
}

let zstdAvailable: boolean | undefined;
function hasZstd(): boolean {
  zstdAvailable ??= spawnSync("zstd", ["--version"]).status === 0;
  return zstdAvailable;
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function ensureLink(target: string, linkPath: string): Promise<boolean> {
  try {
    const st = await lstat(linkPath);
    if (st.isSymbolicLink() && (await readlink(linkPath)) === target) return false;
    await unlink(linkPath);
  } catch {
    /* missing */
  }
  await mkdir(dirname(linkPath), { recursive: true });
  await symlink(target, linkPath);
  return true;
}

function decompress(src: string, dest: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("sh", ["-c", FILTER, "sh", src, dest], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`zstd failed on ${src}: ${stderr || code}`)),
    );
  });
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

export async function prepareCodexMirror(): Promise<MirrorStats> {
  const stats: MirrorStats = { decompressed: 0, linked: 0, removed: 0, skipped: false };
  if (!existsSync(CODEX_SOURCE)) return { ...stats, skipped: true };

  const wanted = new Set<string>();
  const toDecompress: { src: string; dest: string; mtime: Date }[] = [];

  for (const name of LINKED_FILES) {
    const src = join(CODEX_SOURCE, name);
    if (!existsSync(src)) continue;
    const dest = join(CODEX_MIRROR, name);
    wanted.add(dest);
    if (await ensureLink(src, dest)) stats.linked++;
  }

  for (const sub of LOG_DIRS) {
    for (const src of await walk(join(CODEX_SOURCE, sub))) {
      const rel = relative(CODEX_SOURCE, src);
      if (src.endsWith(".jsonl")) {
        const dest = join(CODEX_MIRROR, rel);
        wanted.add(dest);
        if (await ensureLink(src, dest)) stats.linked++;
      } else if (src.endsWith(".jsonl.zst")) {
        const dest = join(CODEX_MIRROR, rel.slice(0, -".zst".length));
        // If both exist, Codex is still writing the plain file: keep the symlink.
        if (wanted.has(dest) || existsSync(src.slice(0, -".zst".length))) continue;
        wanted.add(dest);
        const srcStat = await stat(src);
        const destStat = await lstat(dest).catch(() => null);
        // utimes drops sub-millisecond precision, so allow a one-second margin.
        if (destStat?.isFile() && destStat.mtimeMs + 1000 >= srcStat.mtimeMs) continue;
        toDecompress.push({ src, dest, mtime: srcStat.mtime });
      }
    }
  }

  if (toDecompress.length && hasZstd()) {
    await pool(toDecompress, CONCURRENCY, async ({ src, dest, mtime }) => {
      await mkdir(dirname(dest), { recursive: true });
      const tmp = `${dest}.tmp`;
      await decompress(src, tmp);
      await rm(dest, { force: true });
      await rename(tmp, dest);
      await utimes(dest, mtime, mtime);
      stats.decompressed++;
    });
  } else if (toDecompress.length) {
    console.warn(`[codex] ${toDecompress.length} compressed session(s) skipped: install zstd (brew install zstd).`);
  }

  // Drop mirror entries whose source log is gone.
  for (const sub of LOG_DIRS) {
    for (const p of await walk(join(CODEX_MIRROR, sub))) {
      if (!wanted.has(p)) {
        await rm(p, { force: true });
        stats.removed++;
      }
    }
  }

  return stats;
}
