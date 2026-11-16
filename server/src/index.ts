import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, isDate, localDate } from "./dates.js";
import { sync, syncStatus } from "./sync.js";
import { dataBounds, usage } from "./usage.js";

const PORT = Number(process.env.API_PORT ?? 8787);
const SYNC_INTERVAL_MIN = Number(process.env.SYNC_INTERVAL_MIN ?? 30);

const app = new Hono();

app.get("/api/status", (c) => c.json({ sync: syncStatus(), ...dataBounds() }));

app.get("/api/usage", (c) => {
  const today = localDate();
  const to = isDate(c.req.query("to")) ? c.req.query("to")! : today;
  const fromParam = c.req.query("from");
  const from = fromParam === "all" ? (dataBounds().firstDate ?? to) : isDate(fromParam) ? fromParam : addDays(to, -29);
  if (from > to) return c.json({ error: "from must be <= to" }, 400);
  const agents = c.req.query("agents")?.split(",").filter(Boolean) ?? null;
  return c.json({ ...usage(from, to, agents), sync: syncStatus(), ...dataBounds() });
});

app.post("/api/sync", async (c) => {
  const full = c.req.query("full") === "1";
  try {
    const result = await sync({ full });
    return c.json({ ok: true, result, sync: syncStatus() });
  } catch (err) {
    return c.json({ ok: false, error: err instanceof Error ? err.message : String(err), sync: syncStatus() }, 500);
  }
});

// Production: serve the built frontend.
const webDist = resolve(dirname(fileURLToPath(import.meta.url)), "../../web/dist");
if (existsSync(webDist)) {
  const root = relative(process.cwd(), webDist);
  app.use("/*", serveStatic({ root }));
  app.get("*", serveStatic({ root, path: "index.html" }));
}

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`tokenmaxxing API on http://localhost:${PORT}`);
});

function backgroundSync(reason: string) {
  const t = Date.now();
  sync()
    .then((r) =>
      console.log(
        `[sync:${reason}] since=${r.since ?? "beginning"} days=${r.days} sessions=${r.sessions} in ${Date.now() - t}ms`,
      ),
    )
    .catch((err) => console.error(`[sync:${reason}] failed:`, err instanceof Error ? err.message : err));
}

backgroundSync("startup");
if (SYNC_INTERVAL_MIN > 0) setInterval(() => backgroundSync("interval"), SYNC_INTERVAL_MIN * 60_000);
