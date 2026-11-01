import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const secret = generateKeyPairSync("rsa", {
  modulusLength: 1024,
  publicKeyEncoding: { type: "spki", format: "der" },
  privateKeyEncoding: { type: "pkcs8", format: "der" },
}).publicKey.toString("base64");

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("YOUCAM_API_KEY", "test-client");
  vi.stubEnv("YOUCAM_API_SECRET_KEY", secret);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("YouCam account authentication", () => {
  it("shares one token exchange across concurrent requests and refreshes before expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T12:00:00Z"));
    const fetcher = vi.fn().mockImplementation(async () => Response.json({ result: { access_token: "test-token" } }));
    vi.stubGlobal("fetch", fetcher);
    const { accountAccessToken } = await import("@/lib/youcam/auth");
    expect(await Promise.all([accountAccessToken(), accountAccessToken(), accountAccessToken()])).toEqual(["test-token", "test-token", "test-token"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://yce-api-01.makeupar.com/s2s/v1.0/client/auth");
    const request = JSON.parse(init.body);
    expect(request.client_id).toBe("test-client");
    expect(Buffer.from(request.id_token, "base64")).toHaveLength(128);
    expect(init.body).not.toContain(secret);
    vi.setSystemTime(new Date("2026-10-31T14:00:00Z"));
    await accountAccessToken();
    expect(fetcher).toHaveBeenCalledTimes(2);
    vi.stubEnv("YOUCAM_API_KEY", "replacement-client");
    await accountAccessToken();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("uses the exchanged token only for account balance and the API key for V2 templates", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ result: { access_token: "account-token" } }))
      .mockResolvedValueOnce(Response.json({ status: 200, results: [] }))
      .mockResolvedValueOnce(Response.json({ data: { templates: [] } }));
    vi.stubGlobal("fetch", fetcher);
    const { getCredits, listTemplates } = await import("@/lib/youcam/client");
    await getCredits();
    await listTemplates("hair-transfer");
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe("Bearer account-token");
    expect(fetcher.mock.calls[2][1].headers.Authorization).toBe("Bearer test-client");
  });

  it("does not echo credentials or provider error payloads when authentication fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json({ error: secret }, { status: 401 })));
    const { accountAccessToken } = await import("@/lib/youcam/auth");
    await expect(accountAccessToken()).rejects.toMatchObject({ code: "account_auth_failed", message: "YouCam account authentication failed: HTTP 401" });
    vi.stubEnv("YOUCAM_API_SECRET_KEY", "");
    await expect(accountAccessToken()).rejects.toMatchObject({ code: "missing_account_credentials" });
  });
});
