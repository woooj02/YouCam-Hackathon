// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const persisted = vi.hoisted(() => new Map<string, unknown>());
const composite = vi.hoisted(() => ({ crops: [] as string[], pastes: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/client/idb", () => ({ idbGet: async (key: string) => persisted.get(key), idbSet: async (key: string, value: unknown) => { persisted.set(key, structuredClone(value)); } }));
vi.mock("@/lib/client/images", () => ({ imageDataUrl: async (url: string) => `data:image/jpeg;base64,${btoa(url)}` }));
// happy-dom has no canvas: record what the store asks to crop and paste instead.
vi.mock("@/lib/client/composite", () => ({
  cropHead: async (src: string) => { composite.crops.push(src); return "data:image/jpeg;base64,Y3JvcA=="; },
  pasteHead: async (base: string, head: string) => { composite.pastes.push(`${base}|${head}`); return "data:image/jpeg;base64,cGFzdGVk"; },
}));
import Studio from "@/app/studio/page";
import { StudioProvider, useStudio } from "@/lib/client/store";
import type { Production } from "@/lib/engine/types";

let root: Root;
let current: ReturnType<typeof useStudio>;
function Observe() { current = useStudio(); return null; }
const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const tick = async (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  persisted.clear(); composite.crops.length = 0; composite.pastes.length = 0;
  (globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  history.replaceState({}, "", "/studio?showcase=1&public=1");
  document.body.innerHTML = '<div id="test-root"></div>';
  root = createRoot(document.getElementById("test-root")!);
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});

it("retries makeup on a head crop when the full-length image has no detectable face, and labels the result a composite", async () => {
  const showcase: Production = JSON.parse(readFileSync("public/showcase/production.json", "utf8"));
  const makeupKey = "2df3400f"; // Nick's complete-look makeup, built on his hair layer.
  const hair = showcase.renders["57d80582"];
  delete showcase.renders[makeupKey];
  const runs: unknown[] = [], uploads: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);
    if (url === "/showcase/production.json") return answer(showcase);
    if (url === "/api/status") return answer({ demo: false, agent: false });
    if (url === "/api/youcam/credits") return answer({ balance: 100 });
    if (url.startsWith("/api/youcam/templates")) return answer({ templates: [] });
    if (url === "/api/youcam/upload") { uploads.push(JSON.parse(String(options?.body)).image); return answer({ fileId: `file-${uploads.length}` }); }
    if (url === "/api/youcam/run") { runs.push(JSON.parse(String(options?.body))); return answer({ taskId: runs.length === 1 ? "full-length" : "head-crop", demo: false }); }
    if (url.startsWith("/api/youcam/task")) {
      return url.includes("full-length")
        ? answer({ status: "error", code: "error_no_face", message: "We couldn't find a face." })
        : answer({ status: "success", url: "https://example.com/styled-head.jpg" });
    }
    throw new Error(`Unexpected request: ${url}`);
  }));

  await act(async () => { root.render(createElement(StudioProvider, null, createElement(Studio), createElement(Observe))); });
  await tick(100);
  await act(async () => { current.render(["l-nick"]); });
  await tick(7000);

  const record = current.production!.renders[makeupKey];
  expect(record).toMatchObject({ status: "done", composite: true, demo: false, units: 1, url: "data:image/jpeg;base64,cGFzdGVk" });
  expect(runs).toHaveLength(2);
  // The hair layer for the first attempt, then the head crop for the retry.
  expect(uploads).toEqual([`data:image/jpeg;base64,${btoa(hair.url!)}`, `data:image/jpeg;base64,${btoa("data:image/jpeg;base64,Y3JvcA==")}`]);
  expect(runs[1]).toMatchObject({ fileId: "file-2" });
  expect(composite.crops).toEqual([`data:image/jpeg;base64,${btoa(hair.url!)}`]);
  expect(composite.pastes[0].startsWith(`data:image/jpeg;base64,${btoa(hair.url!)}|`)).toBe(true);
  expect(current.unitsSpent).toBe(1); // The failed full-length task is not charged.
});
