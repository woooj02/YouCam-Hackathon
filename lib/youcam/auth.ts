/** Node-only account authentication, shared by the server and smoke-test CLI. */
import { constants, createHash, createPublicKey, publicEncrypt } from "node:crypto";

const AUTH_URL = "https://yce-api-01.makeupar.com/s2s/v1.0/client/auth";
// Account tokens last two hours; refresh before their documented expiry.
const TOKEN_TTL = 115 * 60_000;
let cached: { fingerprint: string; token: string; expiresAt: number } | undefined;
let pending: { fingerprint: string; promise: Promise<string> } | undefined;

export class YouCamAuthError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(message: string, code: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** V1 account endpoints need an exchanged token; V2 task endpoints use the API key. */
export async function accountAccessToken(): Promise<string> {
  const clientId = process.env.YOUCAM_API_KEY?.trim();
  const secret = process.env.YOUCAM_API_SECRET_KEY?.trim();
  if (!clientId || !secret) {
    throw new YouCamAuthError("Set YOUCAM_API_KEY and YOUCAM_API_SECRET_KEY to read the account balance.", "missing_account_credentials");
  }
  const fingerprint = createHash("sha256").update(`${clientId}\0${secret}`).digest("hex");
  if (cached?.fingerprint === fingerprint && cached.expiresAt > Date.now()) return cached.token;
  if (pending?.fingerprint === fingerprint) return pending.promise;

  const promise = (async () => {
    let idToken: string;
    try {
      const key = createPublicKey({ key: Buffer.from(secret, "base64"), format: "der", type: "spki" });
      idToken = publicEncrypt({ key, padding: constants.RSA_PKCS1_PADDING },
        Buffer.from(`client_id=${clientId}&timestamp=${Date.now()}`),
      ).toString("base64");
    } catch {
      throw new YouCamAuthError("YOUCAM_API_SECRET_KEY must be the matching Base64 X.509 RSA credential.", "invalid_account_secret");
    }
    const response = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, id_token: idToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.json().catch(() => null) as { result?: { access_token?: string } } | null;
    // Never echo the request, returned token or provider error payload in an error.
    if (!response.ok) throw new YouCamAuthError(`YouCam account authentication failed: HTTP ${response.status}`, "account_auth_failed", response.status);
    const token = body?.result?.access_token;
    if (!token || typeof token !== "string") throw new YouCamAuthError("YouCam authentication returned no access token.", "missing_access_token");
    cached = { fingerprint, token, expiresAt: Date.now() + TOKEN_TTL };
    return token;
  })();
  pending = { fingerprint, promise };
  try {
    return await promise;
  } finally {
    if (pending?.promise === promise) pending = undefined;
  }
}
