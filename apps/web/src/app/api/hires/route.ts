// RECORDS_API_URL: base URL of the Records API (default http://localhost:4000).
// Only POST is proxied, so the browser can create a hire but not read the hire list or reach any
// other Records API route through the web origin.
const RECORDS_API_URL = () => process.env.RECORDS_API_URL ?? "http://localhost:4000";

export async function POST(request: Request): Promise<Response> {
  try {
    const upstream = await fetch(`${RECORDS_API_URL()}/hires`, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") ?? "application/json" },
      body: await request.text(),
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
