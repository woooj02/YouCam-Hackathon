// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { act, createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const persisted = vi.hoisted(() => new Map<string, unknown>());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/client/idb", () => ({ idbGet: async (key: string) => persisted.get(key), idbSet: async (key: string, value: unknown) => { persisted.set(key, structuredClone(value)); } }));
vi.mock("@/lib/client/images", () => ({ imageDataUrl: async () => "data:image/jpeg;base64,dGVzdA==" }));
import Studio from "@/app/studio/page";
import PrintCards from "@/app/studio/print/page";
import { StudioProvider, useStudio } from "@/lib/client/store";
import type { Production } from "@/lib/engine/types";
import { directOffline } from "@/lib/director";
import { replanWithout } from "@/lib/engine/solver";
import { pendingStages } from "@/lib/engine/render";

const initial = (): Production => JSON.parse(readFileSync("public/showcase/production.json", "utf8"));
let root: Root;
let current: ReturnType<typeof useStudio>;
function Observe() { current = useStudio(); return null; }
function button(label: string) {
  const found = [...document.querySelectorAll("button")].find((element) => element.textContent?.includes(label));
  if (!found) throw new Error(`No button: ${label}`);
  return found;
}
const click = async (element: HTMLElement) => act(async () => { element.click(); });
const tick = async (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
async function mount(page: ComponentType = Studio) {
  await act(async () => { root.render(createElement(StudioProvider, null, createElement(page), createElement(Observe))); });
}
const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.useFakeTimers();
  persisted.clear();
  (globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  history.replaceState({}, "", "/studio?showcase=1&public=1");
  document.body.innerHTML = '<div id="test-root"></div>';
  root = createRoot(document.getElementById("test-root")!);
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});

function baseFetch(production: Production) {
  return vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);
    if (url === "/showcase/production.json") return answer(production);
    if (url === "/api/status") return answer({ demo: false, agent: false });
    if (url === "/api/youcam/credits") return answer({ balance: 912 });
    if (url.startsWith("/api/youcam/templates")) return answer({ templates: [] });
    if (url === "/api/director") {
      const body = JSON.parse(String(options?.body));
      return answer(directOffline(body.production, body.message));
    }
    throw new Error(`Unexpected request: ${url}`);
  });
}

describe("the complete studio journey", () => {
  it("automatically resumes an interrupted task after reload without creating another", async () => {
    const repaired = replanWithout(initial(), "i-navy-coat").production;
    const active = pendingStages({ ...repaired, renders: {} }).find((stage) => stage.lookId === "l-rowe-sea" && stage.stage === "outer")!;
    repaired.renders[active.key] = { key: active.key, stage: "outer", lookId: active.lookId, status: "running", taskId: "already-bought" };
    const fallback = baseFetch(repaired);
    const fetcher = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      if (String(input).startsWith("/api/youcam/task")) {
        expect(String(input)).toContain("already-bought");
        return answer({ status: "success", url: "https://example.com/saved.jpg" });
      }
      return fallback(input, options);
    });
    vi.stubGlobal("fetch", fetcher);
    await mount(); await tick(3300);
    expect(current.production?.renders[active.key].status).toBe("done");
    expect(fetcher.mock.calls.some(([url]) => String(url) === "/api/youcam/run")).toBe(false);
  });

  it("holds an uncertain creation outcome instead of submitting a second paid task", async () => {
    const repaired = replanWithout(initial(), "i-navy-coat").production;
    const active = pendingStages({ ...repaired, renders: {} }).find((stage) => stage.lookId === "l-rowe-sea" && stage.stage === "outer")!;
    repaired.renders[active.key] = { key: active.key, stage: "outer", lookId: active.lookId, status: "error", creationPending: true };
    const fetcher = baseFetch(repaired); vi.stubGlobal("fetch", fetcher);
    await mount(); await click(button("See opening night")); await tick(300);
    expect(current.production?.renders[active.key].error).toContain("may have started");
    expect(fetcher.mock.calls.some(([url]) => String(url) === "/api/youcam/run")).toBe(false);
    expect(current.unitsSpent).toBe(0);
  });

  it("opens six ready looks, reveals distinct styling, compares makeup and locks approval", async () => {
    vi.stubGlobal("fetch", baseFetch(initial()));
    await mount();
    expect(location.search).not.toContain("showcase");
    expect(document.querySelectorAll("h3")).toHaveLength(6);
    expect(document.body.textContent).toContain("All looks rendered");
    expect(document.body.textContent).toContain("Navy wool greatcoat is on 2 people");
    await click(button("Hair & makeup"));
    expect(document.querySelector('img[alt="Elsie, the masquerade: hair and makeup on Maya"]') ?? document.querySelector('img[alt*="Elsie, the masquerade: hair and makeup"]')).not.toBeNull();
    await click(button("Elsie, the masquerade"));
    await click(button("Makeup only"));
    expect(document.querySelector('input[aria-label*="before and after"]')).not.toBeNull();
    expect(document.body.textContent).toContain("intensity 80/100");
    await click(button("Approve & lock look"));
    expect(current.production?.looks.find((look) => look.id === "l-elsie-party")?.locked).toBe(true);
    await click(button("Close"));
    await click(button("Looks")); // Restore rack and keep every finished preview.
    expect(pendingStages(current.production!)).toEqual([]);
    expect(current.production?.performers.every((performer) => performer.bodyPhoto)).toBe(true);
  });

  it("repairs only the coat, exposes its priced basket and keeps the result through reload", async () => {
    const fetcher = baseFetch(initial()); vi.stubGlobal("fetch", fetcher);
    await mount();
    const input = document.querySelector('input[placeholder="Tell ENCORE what changed…"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "The navy greatcoat has moth damage, we can't use it");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { input.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    await tick(1200);
    expect(document.body.textContent).toContain("1 of 23 layers changed. 22 kept.");
    expect(document.body.textContent).toContain("Saved preview reused · 0 new units");
    expect(current.production?.plan?.cost).toBe(40);
    await click(button("Sourcing ·"));
    expect(document.body.textContent).toContain("Footlights Costume Hire");
    expect(fetcher.mock.calls.some(([url]) => String(url) === "/api/youcam/run")).toBe(false);
    await act(async () => { root.unmount(); });
    history.replaceState({}, "", "/studio");
    root = createRoot(document.getElementById("test-root")!);
    await mount(PrintCards);
    expect(current.production?.plan?.cost).toBe(40);
    expect(document.body.textContent).toContain("Footlights Costume Hire");
    expect(document.querySelectorAll("article")).toHaveLength(6);
  });

  it("resumes a failed poll with the saved task id and never buys a duplicate render", async () => {
    const repaired = replanWithout(initial(), "i-navy-coat").production;
    const changed = pendingStages(repaired); // The public replacement is cached; remove just it.
    expect(changed).toEqual([]);
    // The old and repaired graphs share every layer except Rowe's outer layer.
    const active = pendingStages({ ...repaired, renders: {} }).find((stage) => stage.lookId === "l-rowe-sea" && stage.stage === "outer")!;
    delete repaired.renders[active.key];
    let polls = 0, creates = 0;
    const fallback = baseFetch(repaired);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input);
      if (url === "/api/youcam/upload") return answer({ fileId: "uploaded-parent" });
      if (url === "/api/youcam/run") { creates++; return answer({ taskId: "saved-task", demo: false }); }
      if (url.startsWith("/api/youcam/task")) {
        expect(url).toContain("saved-task"); polls++;
        return polls === 1 ? answer({ message: "Temporary poll failure" }, 503) : answer({ status: "success", url: "https://example.com/repaired.jpg" });
      }
      return fallback(input, options);
    }));
    await mount();
    await click(button("See opening night"));
    await tick(3300);
    expect(current.production?.renders[active.key]).toMatchObject({ status: "error", taskId: "saved-task" });
    expect(current.rendering).toBe(false);
    await click(button("See opening night"));
    await tick(3300);
    expect(current.production?.renders[active.key]).toMatchObject({ status: "done", taskId: "saved-task" });
    expect(current.production?.renders[active.key].url).toMatch(/^data:image\//);
    expect(creates).toBe(1);
    expect(polls).toBe(2);
    expect(current.unitsSpent).toBe(2);
    expect(pendingStages(current.production!)).toEqual([]);
  });
});
