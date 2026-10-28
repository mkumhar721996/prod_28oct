import { afterEach, describe, expect, it, vi } from "vitest";
import * as route from "./route";

afterEach(() => vi.unstubAllGlobals());

describe("/api/hires proxy", () => {
  it("forwards POST bodies to the Records API and relays status and body", async () => {
    const upstream = vi.fn(async () => new Response(JSON.stringify({ errors: { email: "dup" } }), { status: 409 }));
    vi.stubGlobal("fetch", upstream);
    const res = await route.POST(new Request("http://web/api/hires", { method: "POST", body: '{"a":1}' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ errors: { email: "dup" } });
    const [url, init] = upstream.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/hires$/);
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"a":1}');
  });

  it("answers 502 when the Records API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    const res = await route.POST(new Request("http://web/api/hires", { method: "POST", body: "{}" }));
    expect(res.status).toBe(502);
  });

  it("rejects an oversized body with 413 without calling the Records API", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const body = JSON.stringify({ name: "x".repeat(20_000) });
    const res = await route.POST(new Request("http://web/api/hires", { method: "POST", body }));
    expect(res.status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("does not expose the hire list (no GET handler)", () => {
    expect((route as Record<string, unknown>).GET).toBeUndefined();
  });
});
