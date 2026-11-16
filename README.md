# Tokenmaxxing

Local dashboard for your AI token usage (Claude Code, Codex, OpenCode…), powered by [ccusage](https://github.com/ryoppippi/ccusage).

- `server/`: Node + TypeScript (Hono, SQLite via `node:sqlite`). Runs ccusage, stores the results and serves the API.
- `web/`: React 19 + Vite, [Lenso UI](https://ui.lenso.dev/) components (built on [UI SDK](https://ui-sdk.dev/)), Recharts chart.

The interface is available in French, English and Chinese: the browser language is detected (English by default), and a menu at the bottom of the page switches it. Strings live in `web/src/i18n.tsx`.

## Requirements

- Node.js 22.13 or later (for `node:sqlite`) and pnpm
- [ccusage](https://github.com/ryoppippi/ccusage) on your `PATH` (`npm i -g ccusage`), or its path in `CCUSAGE_BIN`
- `zstd`, only if you use Codex (see below)

Everything stays local: the server reads the agents' logs on your machine and stores them in a SQLite database ignored by git.

## Run

```bash
pnpm install
pnpm dev          # API on :8787, dashboard on http://localhost:5173
```

Production (the API serves the built frontend):

```bash
pnpm build && pnpm start   # http://localhost:8787
```

## Incremental sync

Data is stored in `server/data/usage.db` (SQLite).

- First run: `ccusage daily --by-agent --json` and `ccusage session --json` over the whole history.
- Later runs: only `--since <last synced day − 1>`. Re-fetched days replace the stored ones; older days are never recomputed.
- Triggers: on server start, every 30 min (`SYNC_INTERVAL_MIN`), the ↻ button on the dashboard, or `pnpm sync` from the CLI.
- Rebuild everything (e.g. after ccusage updates its prices): `pnpm sync --full` or `POST /api/sync?full=1`.

### Compressed Codex logs

Codex compresses older sessions to `.jsonl.zst`, which ccusage does not read. Before each sync, the server keeps a mirror up to date in `server/data/codex-home`: `.jsonl` files are symlinked, and each `.zst` is decompressed once, keeping only the lines needed for counting (about 30x smaller). ccusage runs with `CODEX_HOME` pointing at this mirror. This needs `zstd` (`brew install zstd` or `apt install zstd`); without it, compressed sessions are skipped with a warning.

## Environment variables

| Variable            | Default                | Purpose                                 |
| ------------------- | ---------------------- | --------------------------------------- |
| `API_PORT`          | `8787`                 | API port                                |
| `SYNC_INTERVAL_MIN` | `30`                   | Auto-sync interval in minutes (0 = off) |
| `CCUSAGE_BIN`       | `ccusage`              | ccusage binary to run                   |
| `TOKENMAXXING_DB`   | `server/data/usage.db` | SQLite database path                    |

## API

- `GET /api/usage?from=YYYY-MM-DD&to=YYYY-MM-DD&agents=claude,codex`: totals and breakdown by agent, model and day. `from=all` starts at the first stored day.
- `POST /api/sync[?full=1]`: starts a sync (one at a time).
- `GET /api/status`: last sync status and data bounds.

## Limitations

- ccusage reports one cost per model, not per token type. The "Cost by type" split and "Cache savings" are estimated from per-provider price ratios (`server/src/usage.ts`).
- Sessions are only used to count activity; a session counts toward every period in which it was active.

## License

[MIT](LICENSE)
