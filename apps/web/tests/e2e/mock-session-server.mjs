// Stand-in for the Records API, used only by the e2e web server.
// Session: signed in when the forwarded Cookie header contains `e2e-session=1`.
// Orders (GET /orders?tab&limit&cursor): a fixed fixture, newest first. Cookie `e2e-orders=none`
// returns no orders; `e2e-orders=fail-page-2` fails every request that carries a cursor (500);
// `e2e-orders=slow-page-2` delays those requests.
import { createServer } from "node:http";

const port = Number(process.env.MOCK_SESSION_PORT ?? 3101);

const ACTIVE = ["Received", "Preparing", "Ready for pickup"];
const ORDERS = Array.from({ length: 14 }, (_, i) => {
  const status = i < 8 ? ACTIVE[i % 3] : i % 2 ? "Fulfilled" : "Cancelled";
  return {
    id: `o${i}`,
    number: String(1060 - i),
    title: `Order title ${1060 - i}`,
    status,
    placedAt: new Date(Date.UTC(2026, 9, 28, 12, 40) - i * 3_600_000).toISOString(),
  };
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const cookie = req.headers.cookie ?? "";
  if (req.method === "GET" && url.pathname === "/session") {
    const signedIn = cookie.includes("e2e-session=1");
    res.writeHead(signedIn ? 200 : 401, { "content-type": "application/json" });
    res.end(JSON.stringify(signedIn ? { role: "hr" } : {}));
    return;
  }
  if (req.method === "GET" && url.pathname === "/orders") {
    const cursor = url.searchParams.get("cursor");
    if (cursor !== null && cookie.includes("e2e-orders=fail-page-2")) {
      res.writeHead(500).end();
      return;
    }
    if (cursor !== null && cookie.includes("e2e-orders=slow-page-2")) await sleep(1500);
    const past = url.searchParams.get("tab") === "past";
    // Pages are capped at 5 so the small fixture spans several pages.
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 5);
    const all = cookie.includes("e2e-orders=none") ? [] : ORDERS;
    const mine = all.filter((o) => (o.status === "Fulfilled" || o.status === "Cancelled") === past);
    const start = Number(cursor ?? 0);
    const items = mine.slice(start, start + limit);
    const next = start + limit < mine.length ? String(start + limit) : null;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ items, nextCursor: next, hasAnyOrders: all.length > 0 }));
    return;
  }
  res.writeHead(404).end();
}).listen(port);
