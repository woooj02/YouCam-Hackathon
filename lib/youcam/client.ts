/**
 * YouCam API client (server-only). The Bearer key never leaves the server.
 *
 * Pipeline: POST /s2s/v2.0/file -> PUT bytes to presigned URL -> POST task
 * -> client polls GET task/{id} through our thin proxy. Engine failures
 * arrive as HTTP 200 with task_status "error" and a stringified tuple.
 */
import "server-only";
import { FEATURES, type FeatureId } from "./features";

export const YOUCAM_BASE = "https://yce-api-01.makeupar.com";

export class YouCamError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

function apiKey(): string {
  const key = process.env.YOUCAM_API_KEY;
  if (!key) throw new YouCamError("YOUCAM_API_KEY is not set", "no_key");
  return key;
}

export function isDemoMode(): boolean {
  return !process.env.YOUCAM_API_KEY || process.env.ENCORE_DEMO === "1";
}

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${YOUCAM_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const code =
      (body as { error_code?: string })?.error_code ??
      (res.status === 429 ? "rate_limited" : `http_${res.status}`);
    throw new YouCamError(`YouCam ${path} failed: HTTP ${res.status}`, code, res.status);
  }
  return body;
}

/** Register a file, PUT the bytes, return the reusable file_id. */
export async function uploadImage(bytes: ArrayBuffer, contentType: string, fileName = "photo.jpg") {
  if (bytes.byteLength > 10 * 1024 * 1024) {
    throw new YouCamError("Image is larger than 10MB", "exceed_max_filesize");
  }
  const body = (await api("/s2s/v2.0/file", {
    method: "POST",
    body: JSON.stringify({
      files: [{ content_type: contentType, file_name: fileName, file_size: bytes.byteLength }],
    }),
  })) as { data?: { files?: { file_id?: string; requests?: { url?: string; method?: string; headers?: Record<string, string> }[] }[] } };

  const file = body?.data?.files?.[0];
  const request = file?.requests?.[0];
  if (!file?.file_id || !request?.url) {
    throw new YouCamError("File registration returned an unexpected shape", "bad_upload_shape");
  }
  const put = await fetch(request.url, {
    method: request.method || "PUT",
    headers: request.headers ?? { "Content-Type": contentType },
    body: bytes,
  });
  if (!put.ok) throw new YouCamError(`Presigned upload failed: HTTP ${put.status}`, "upload_failed");
  return file.file_id;
}

export async function createTask(feature: FeatureId, body: Record<string, unknown>): Promise<string> {
  const res = (await api(FEATURES[feature].taskPath, {
    method: "POST",
    body: JSON.stringify(body),
  })) as { data?: { task_id?: string } };
  const taskId = res?.data?.task_id;
  if (!taskId) throw new YouCamError("Task creation returned no task_id", "no_task_id");
  return taskId;
}

export type TaskState =
  | { status: "running" }
  | { status: "success"; results: unknown }
  | { status: "error"; code: string; message: string };

/** Error field arrives as a stringified tuple: "('message', 'error_code')". */
export function parseErrorTuple(raw: unknown): { code: string; message: string } {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
  const match = /\('(.+?)',\s*'(.+?)'\)/.exec(text);
  if (match) return { message: match[1], code: match[2] };
  if (/^[a-z_]+$/.test(text)) return { message: text, code: text };
  return { message: text, code: "unknown_error" };
}

export function parseTaskBody(body: unknown): TaskState {
  const data = (body as { data?: { task_status?: string; error?: unknown; results?: unknown } })?.data;
  if (data?.task_status === "success") return { status: "success", results: data.results ?? null };
  if (data?.task_status === "error") return { status: "error", ...parseErrorTuple(data.error) };
  return { status: "running" };
}

export async function getTask(feature: FeatureId, taskId: string): Promise<TaskState> {
  const body = await api(`${FEATURES[feature].taskPath}/${encodeURIComponent(taskId)}`);
  return parseTaskBody(body);
}

export async function listTemplates(feature: FeatureId, pageSize = 20): Promise<unknown> {
  const path = FEATURES[feature].templatePath;
  if (!path) throw new YouCamError(`${feature} has no templates`, "no_templates");
  return api(`${path}?page_size=${pageSize}`);
}

/** Server-side wait, for the agent's tools (UI routes poll from the client instead). */
export async function runToCompletion(
  feature: FeatureId,
  body: Record<string, unknown>,
  { timeoutMs = 60_000, intervalMs = 2_000 } = {},
): Promise<TaskState> {
  const taskId = await createTask(feature, body);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const state = await getTask(feature, taskId);
    if (state.status !== "running") return state;
  }
  return { status: "error", code: "timeout", message: `${feature} did not finish in time` };
}
