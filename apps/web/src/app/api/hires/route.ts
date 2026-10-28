// RECORDS_API_URL: base URL of the Records API (default http://localhost:4000).
// Only POST is proxied, so the browser can create a hire but not read the hire list or reach any
// other Records API route through the web origin.
const RECORDS_API_URL = () => process.env.RECORDS_API_URL ?? "http://localhost:4000";

// A hire is four short fields; anything near this size is not a legitimate request.
const MAX_BODY_BYTES = 8 * 1024;

// Global fixed-window ceiling, a stopgap until sign-in exists. Route handlers expose no trusted
// client address and x-forwarded-for is client-controlled, so a per-client key is bypassable; one
// counter is spoof-proof and constant-size. It caps total invite volume but is per instance, and a
// flood can lock HR out until the window ends.
const WINDOW_MS = 60_000;
const MAX_POSTS_PER_WINDOW = 60;
const UPSTREAM_TIMEOUT_MS = 10_000;
const window = { count: 0, resetAt: 0 };

function rateLimited(): boolean {
  const now = Date.now();
  if (now >= window.resetAt) {
    window.count = 0;
    window.resetAt = now + WINDOW_MS;
  }
  window.count += 1;
  return window.count > MAX_POSTS_PER_WINDOW;
}

export async function POST(request: Request): Promise<Response> {
  if (rateLimited()) {
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
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    console.error("POST /api/hires: Records API request failed", error);
    return Response.json({ errors: {}, message: "The Records API is unavailable." }, { status: 502 });
  }
}
