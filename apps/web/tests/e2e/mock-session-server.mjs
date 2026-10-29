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

// Game (GET /game, POST /game/spin): in-memory balance and pool per `e2e-game=<id>` cookie, so each
// test starts fresh with its own id (a missing cookie shares the id "default"). An id starting with
// `low` starts at 100 credits. Spins alternate win (two cherries, 1x) and loss.
const SHARES = [40, 30, 20, 10];
const games = new Map();
function gameFor(cookie) {
  const id = /e2e-game=([^;]+)/.exec(cookie)?.[1] ?? "default";
  if (!games.has(id)) games.set(id, { balance: id.startsWith("low") ? 100 : 1000, tiers: [0, 0, 0, 0], spins: 0 });
  return games.get(id);
}
const jackpotOf = (tiers) => ({
  miniCents: tiers[0],
  minorCents: tiers[1],
  majorCents: tiers[2],
  grandCents: tiers[3],
  totalCents: tiers.reduce((a, b) => a + b, 0),
});
const readBody = async (req) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
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
  if (url.pathname === "/game" || url.pathname === "/game/spin") {
    if (!cookie.includes("e2e-session=1")) {
      res.writeHead(401, { "content-type": "application/json" }).end("{}");
      return;
    }
    const game = gameFor(cookie);
    res.writeHead(200, { "content-type": "application/json" });
    if (req.method === "GET" && url.pathname === "/game") {
      res.end(JSON.stringify({ balanceCredits: game.balance, jackpot: jackpotOf(game.tiers) }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/game/spin") {
      const { bet } = await readBody(req);
      if (game.balance < bet) {
        res.writeHead(409, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            message: `Your balance of ${game.balance} does not cover a bet of ${bet}. Choose a lower bet.`,
            balanceCredits: game.balance,
          }),
        );
        return;
      }
      const won = game.spins++ % 2 === 0;
      const winCredits = won ? bet : 0;
      game.balance += winCredits - bet;
      game.tiers = game.tiers.map((c, i) => c + Math.floor((bet * 5 * SHARES[i] + 50) / 100));
      res.end(
        JSON.stringify({
          reels: won ? ["cherry", "cherry", "bar"] : ["bar", "bell", "seven"],
          bet,
          winCredits,
          label: won ? "Two cherries pay 1× your bet." : null,
          balanceCredits: game.balance,
          jackpot: jackpotOf(game.tiers),
        }),
      );
      return;
    }
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
