import { sync } from "./sync.js";

const full = process.argv.includes("--full");
const result = await sync({ full });
console.log(
  `Codex: ${result.codex.decompressed} compressed log(s) decompressed, ${result.codex.linked} linked, ${result.codex.removed} removed.`,
);
console.log(
  `Synced ${result.days} day(s) and ${result.sessions} session(s) since ${result.since ?? "the beginning"} in ${result.durationMs} ms.`,
);
