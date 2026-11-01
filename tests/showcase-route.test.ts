import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("node:fs/promises", () => ({ readFile: vi.fn(async () => '{"id":"private-rehearsal"}') }));
import { readFile } from "node:fs/promises";
import { GET } from "@/app/api/showcase/route";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("private rehearsal isolation", () => {
  it("serves only an explicitly enabled local rehearsal with no caching", async () => {
    vi.stubEnv("ENCORE_LOCAL_SHOWCASE", "1"); vi.stubEnv("VERCEL", "");
    const response = await GET(new Request("http://127.0.0.1:3100/api/showcase", { headers: { host: "127.0.0.1:3100" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ id: "private-rehearsal" });
  });

  it("never reads the private file for public requests, disabled rehearsal or Vercel", async () => {
    vi.stubEnv("ENCORE_LOCAL_SHOWCASE", "1"); vi.stubEnv("VERCEL", "");
    expect((await GET(new Request("https://encore.example.com/api/showcase"))).status).toBe(404);
    expect((await GET(new Request("http://127.0.0.1:3100/api/showcase", { headers: { host: "encore.example.com" } }))).status).toBe(404);
    expect((await GET(new Request("http://127.0.0.1:3100/api/showcase", { headers: { host: "localhost:3100", "x-forwarded-host": "encore.example.com" } }))).status).toBe(404);
    vi.stubEnv("ENCORE_LOCAL_SHOWCASE", "");
    expect((await GET(new Request("http://localhost/api/showcase"))).status).toBe(404);
    vi.stubEnv("ENCORE_LOCAL_SHOWCASE", "1"); vi.stubEnv("VERCEL", "1");
    expect((await GET(new Request("http://localhost/api/showcase"))).status).toBe(404);
    expect(readFile).not.toHaveBeenCalled();
  });

  it("selects a separate local film take without exposing arbitrary files", async () => {
    vi.stubEnv("ENCORE_LOCAL_SHOWCASE", "1"); vi.stubEnv("VERCEL", "");
    await GET(new Request("http://localhost/api/showcase?take=film", { headers: { host: "localhost" } }));
    expect(readFile).toHaveBeenCalledWith(expect.stringContaining(".local/film/production.json"), "utf8");
    await GET(new Request("http://localhost/api/showcase?take=../../.env.local", { headers: { host: "localhost" } }));
    expect(readFile).toHaveBeenLastCalledWith(expect.stringContaining(".local/showcase/production.json"), "utf8");
  });
});
