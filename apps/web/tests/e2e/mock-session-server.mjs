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

// Order placement (POST /orders): 401 without the session cookie; 400 for an empty cart; otherwise 201
// with number 1001 (200 for a repeated idempotency key). Cookie `e2e-order=fail-once` fails the first
// request after a reset with 500; `e2e-order=slow` delays the answer. The keys received are listed at
// GET /e2e/order-keys and cleared by POST /e2e/reset-orders.
let orderKeys = [];
let orderFailures = 0;
const readBody = async (req) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const cookie = req.headers.cookie ?? "";
  if (req.method === "GET" && url.pathname === "/session") {
    const signedIn = cookie.includes("e2e-session=1");
    res.writeHead(signedIn ? 200 : 401, { "content-type": "application/json" });
    res.end(JSON.stringify(signedIn ? { role: "player", email: "ana@example.com" } : {}));
    return;
  }
  if (req.method === "GET" && url.pathname === "/wallet") {
    const signedIn = cookie.includes("e2e-session=1");
    res.writeHead(signedIn ? 200 : 401, { "content-type": "application/json" });
    // Cookie `e2e-balance=1` is a player with 1 credit, who may claim free credits.
    const low = cookie.includes("e2e-balance=1");
    const balanceCredits = low ? 1 : 1000;
    res.end(
      JSON.stringify(
        signedIn ? { balanceCredits, topUp: { eligible: low, credits: 500 } } : {},
      ),
    );
    return;
  }
  if (req.method === "GET" && url.pathname === "/wallet/history") {
    const signedIn = cookie.includes("e2e-session=1");
    res.writeHead(signedIn ? 200 : 401, { "content-type": "application/json" });
    const entries = [
      { id: "2", kind: "bet", amountCredits: 100, balanceCredits: 900, createdAt: "2026-10-28T14:30:00.000Z" },
      { id: "1", kind: "grant", amountCredits: 1000, balanceCredits: 1000, createdAt: "2026-10-27T09:00:00.000Z" },
    ];
    res.end(
      JSON.stringify(
        signedIn ? { entries, page: 1, pageCount: 1, total: 2, range: "recent" } : {},
      ),
    );
    return;
  }
  if (req.method === "POST" && url.pathname === "/wallet/top-up") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ balanceCredits: 501, grantedCredits: 500 }));
    return;
  }
  if (req.method === "GET" && url.pathname === "/e2e/order-keys") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(orderKeys));
    return;
  }
  if (req.method === "POST" && url.pathname === "/e2e/reset-orders") {
    orderKeys = [];
    orderFailures = 0;
    res.writeHead(204).end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/orders") {
    if (!cookie.includes("e2e-session=1")) {
      res.writeHead(401).end();
      return;
    }
    const body = await readBody(req);
    if (cookie.includes("e2e-order=slow")) await sleep(1500);
    if (cookie.includes("e2e-order=fail-once") && orderFailures === 0) {
      orderFailures += 1;
      orderKeys.push(body.idempotencyKey);
      res.writeHead(500).end();
      return;
    }
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      res.writeHead(400).end();
      return;
    }
    const replay = orderKeys.slice(orderFailures).includes(body.idempotencyKey);
    orderKeys.push(body.idempotencyKey);
    res.writeHead(replay ? 200 : 201, { "content-type": "application/json" });
    res.end(JSON.stringify({ order: { id: "o-new", number: "1001" } }));
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
