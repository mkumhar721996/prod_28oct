// Stand-in for the Records API, used only by the e2e web server.
// Session: signed in when the forwarded Cookie header contains `e2e-session=1`.
// Cookie `e2e-hr=1` on top of that makes the session role `hr` and lets it write onboarding templates.
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

// Onboarding templates, kept in memory. Cookie `e2e-hr=1` makes the signed-in user HR; only HR may
// POST or PUT (403 otherwise). Software engineer is seeded; the other roles start without a template.
const ROLES = [
  { role: "software-engineer", name: "Software engineer" },
  { role: "customer-support-agent", name: "Customer support agent" },
  { role: "account-manager", name: "Account manager" },
];
const seedTemplates = () =>
  new Map([
    [
      "software-engineer",
      {
        planCount: 14,
        tasks: [
          { title: "Set up laptop", owner: "it", dueOffsetDays: -3 },
          { title: "Hold 90-day review", owner: "hiring_manager", dueOffsetDays: 90 },
        ],
      },
    ],
  ]);
// `POST /__reset` restores the seed so e2e tests start from the same state on every run or retry.
const templates = seedTemplates();
const nameOf = (role) => ROLES.find((r) => r.role === role)?.name ?? role;
const view = (role) => ({ role, name: nameOf(role), ...templates.get(role) });
const readJson = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString() || "{}");
};
const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
const bad = (message) => ({ code: "invalid", message });

// Game (GET /game, POST /game/spin), in memory. The balance starts at 1000, or at 100 with cookie
// `e2e-game-balance=100`. Spins alternate win (two cherries, pays 1x the bet) then loss; a bet above the
// balance is a 409. `POST /__reset` clears it.
const newGame = () => ({ balance: null, spins: 0, tiers: [0, 0, 0, 0] });
let game = newGame();
const share = (bet, pct) => Math.floor((bet * 5 * pct + 50) / 100);
const gameBalance = (cookie) => game.balance ?? (cookie.includes("e2e-game-balance=100") ? 100 : 1000);
const jackpotView = () => {
  const [miniCents, minorCents, majorCents, grandCents] = game.tiers;
  return { miniCents, minorCents, majorCents, grandCents, totalCents: game.tiers.reduce((a, b) => a + b, 0) };
};

async function handleGame(req, res, url, cookie) {
  if (!cookie.includes("e2e-session=1")) return json(res, 401, {});
  const balance = gameBalance(cookie);
  if (req.method === "GET") return json(res, 200, { balanceCredits: balance, jackpot: jackpotView() });
  const { bet } = await readJson(req);
  if (![10, 25, 50, 100, 250].includes(bet)) return json(res, 400, bad("Choose a bet."));
  if (balance < bet) {
    return json(res, 409, {
      message: `Your balance of ${balance} does not cover a bet of ${bet}. Choose a lower bet.`,
      balanceCredits: balance,
    });
  }
  const won = game.spins++ % 2 === 0;
  const winCredits = won ? bet : 0;
  game.balance = balance - bet + winCredits;
  game.tiers = game.tiers.map((cents, i) => cents + share(bet, [40, 30, 20, 10][i]));
  return json(res, 200, {
    reels: won ? ["cherry", "cherry", "bar"] : ["bar", "seven", "bell"],
    bet,
    winCredits,
    label: won ? "Two cherries pay 1× your bet." : null,
    balanceCredits: game.balance,
    jackpot: jackpotView(),
  });
}

async function handleTemplates(req, res, url, cookie) {
  if (!cookie.includes("e2e-session=1")) return json(res, 401, {});
  const parts = url.pathname.split("/").filter(Boolean);
  const role = parts[1];
  if (req.method === "GET" && parts.length === 1) {
    return json(
      res,
      200,
      [...templates].map(([r, t]) => ({
        role: r,
        name: nameOf(r),
        taskCount: t.tasks.length,
        planCount: t.planCount,
      })),
    );
  }
  if (req.method === "GET" && role === "roles") return json(res, 200, ROLES);
  if (req.method === "GET") {
    return templates.has(role) ? json(res, 200, view(role)) : json(res, 404, {});
  }
  if (!cookie.includes("e2e-hr=1")) return json(res, 403, {});
  const body = await readJson(req);
  const target = req.method === "POST" ? body.role : role;
  if (req.method === "POST" && templates.has(target)) {
    return json(res, 409, { code: "role_exists", message: `A template already exists for ${nameOf(target)}.` });
  }
  if (req.method === "PUT" && !templates.has(target)) return json(res, 404, {});
  if (!Array.isArray(body.tasks) || body.tasks.length === 0) {
    return json(res, 400, bad("Add at least one task before saving."));
  }
  templates.set(target, { planCount: templates.get(target)?.planCount ?? 0, tasks: body.tasks });
  return json(res, req.method === "POST" ? 201 : 200, { ok: true });
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const cookie = req.headers.cookie ?? "";
  if (req.method === "GET" && url.pathname === "/session") {
    const signedIn = cookie.includes("e2e-session=1");
    res.writeHead(signedIn ? 200 : 401, { "content-type": "application/json" });
    const role = cookie.includes("e2e-hr=1") ? "hr" : "player";
    res.end(JSON.stringify(signedIn ? { role, email: "ana@example.com" } : {}));
    return;
  }
  if (req.method === "POST" && url.pathname === "/__reset") {
    templates.clear();
    for (const [role, template] of seedTemplates()) templates.set(role, template);
    game = newGame();
    return json(res, 200, { ok: true });
  }
  if (url.pathname === "/game" || url.pathname === "/game/spin") {
    await handleGame(req, res, url, cookie);
    return;
  }
  if (url.pathname === "/onboarding-templates" || url.pathname.startsWith("/onboarding-templates/")) {
    await handleTemplates(req, res, url, cookie);
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
