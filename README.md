# Tokenmaxxing

Dashboard local de consommation de tokens IA (Claude Code, Codex, OpenCode…), alimenté par [ccusage](https://github.com/ryoppippi/ccusage).

- `server/` : Node + TypeScript (Hono, SQLite via `node:sqlite`). Lance ccusage, stocke les résultats et sert l'API.
- `web/` : React 19 + Vite, composants [Lenso UI](https://ui.lenso.dev/) (sur [UI SDK](https://ui-sdk.dev/)), graphique Recharts.

## Prérequis

- Node.js 22.13 ou plus récent (pour `node:sqlite`) et pnpm
- [ccusage](https://github.com/ryoppippi/ccusage) dans le `PATH` (`npm i -g ccusage`), ou son chemin dans `CCUSAGE_BIN`
- `zstd`, seulement si tu utilises Codex (voir plus bas)

Tout reste en local : le serveur lit les logs des agents sur ta machine et les stocke dans une base SQLite ignorée par git.

## Lancer

```bash
pnpm install
pnpm dev          # API sur :8787, dashboard sur http://localhost:5173
```

Production (sert le build du front depuis l'API) :

```bash
pnpm build && pnpm start   # http://localhost:8787
```

## Synchro incrémentale

Les données sont stockées dans `server/data/usage.db` (SQLite).

- Premier run : `ccusage daily --by-agent --json` et `ccusage session --json` sur tout l'historique.
- Runs suivants : seulement `--since <dernier jour synchronisé − 1>`. Les jours re-récupérés remplacent ceux en base ; les jours plus anciens ne sont plus jamais recalculés.
- Déclencheurs : au démarrage du serveur, toutes les 30 min (`SYNC_INTERVAL_MIN`), le bouton ↻ du dashboard, ou `pnpm sync` en CLI.
- Tout recalculer (ex. après une mise à jour des prix de ccusage) : `pnpm sync --full` ou `POST /api/sync?full=1`.

### Logs Codex compressés

Codex compresse ses anciennes sessions en `.jsonl.zst`, que ccusage ne lit pas. Avant chaque synchro, le serveur tient à jour un miroir dans `server/data/codex-home` : les `.jsonl` y sont liés, et chaque `.zst` est décompressé une seule fois en ne gardant que les lignes utiles au comptage (environ 30 fois plus petit). ccusage est lancé avec `CODEX_HOME` pointé sur ce miroir. Il faut `zstd` (`brew install zstd` ou `apt install zstd`) ; sans lui, les sessions compressées sont ignorées avec un avertissement.

## Variables d'environnement

| Variable            | Défaut                 | Rôle                                       |
| ------------------- | ---------------------- | ------------------------------------------ |
| `API_PORT`          | `8787`                 | Port de l'API                              |
| `SYNC_INTERVAL_MIN` | `30`                   | Intervalle de synchro auto (0 = désactivé) |
| `CCUSAGE_BIN`       | `ccusage`              | Binaire ccusage à appeler                  |
| `TOKENMAXXING_DB`   | `server/data/usage.db` | Chemin de la base SQLite                   |

## API

- `GET /api/usage?from=YYYY-MM-DD&to=YYYY-MM-DD&agents=claude,codex` : totaux, répartition par agent, modèle et jour. `from=all` part du premier jour stocké.
- `POST /api/sync[?full=1]` : lance une synchro (une seule à la fois).
- `GET /api/status` : état de la dernière synchro et bornes des données.

## Limites

- ccusage donne un coût par modèle, pas par type de token. La répartition « Coût par type » et l'« Économie du cache » sont estimées avec des ratios de prix par fournisseur (`server/src/usage.ts`).
- Les sessions servent seulement à compter l'activité ; une session est comptée sur chaque période où elle a été active.
