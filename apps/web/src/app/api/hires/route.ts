// RECORDS_API_URL: base URL of the Records API (default http://localhost:4000).
// Only POST is proxied, so the browser can create a hire but not read the hire list or reach any
// other Records API route through the web origin.
const RECORDS_API_URL = () => process.env.RECORDS_API_URL ?? "http://localhost:4000";

// A hire is four short fields; anything near this size is not a legitimate request.
const MAX_BODY_BYTES = 8 * 1024;

// Per-instance fixed window: a stopgap until sign-in exists. It slows invite spam from one client
// but is not shared across instances and trusts the proxy's x-forwarded-for.
const WINDOW_MS = 60_000;
const MAX_POSTS_PER_WINDOW = 10;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(request: Request): boolean {
  const now = Date.now();
  for (const [key, h] of hits) if (h.resetAt <= now) hits.delete(key);
  const client = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const h = hits.get(client) ?? { count: 0, resetAt: now + WINDOW_MS };
  h.count += 1;
  hits.set(client, h);
  return h.count > MAX_POSTS_PER_WINDOW;
}

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(request)) {
    return Response.json({ errors: {}, message: "Too many requests." }, { status: 429 });
  }
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
      return Response.json({ errors: {}, message: "Request body too large." }, { status: 413 });
    }
    const upstream = await fetch(`${RECORDS_API_URL()}/hires`, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") ?? "application/json" },
      body,
      cache: "no-store",
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json({ errors: {}, message: "The Records API is unavailable." }, { status: 502 });
  }
}
