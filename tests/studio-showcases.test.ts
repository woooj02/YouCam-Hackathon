// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const persisted = vi.hoisted(() => new Map<string, unknown>());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/client/idb", () => ({ idbGet: async (key: string) => persisted.get(key), idbSet: async (key: string, value: unknown) => { persisted.set(key, structuredClone(value)); } }));
import Studio from "@/app/studio/page";
import { StudioProvider } from "@/lib/client/store";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
let root: Root;
const requested: string[] = [];

beforeEach(() => {
  persisted.clear(); requested.length = 0;
  (globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '<div id="r"></div>';
  root = createRoot(document.getElementById("r")!);
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input); requested.push(url);
    if (url === "/showcase/midsummer/production.json") return json(JSON.parse(readFileSync("public/showcase/midsummer/production.json", "utf8")));
    if (url === "/showcase/production.json") return json(JSON.parse(readFileSync("public/showcase/production.json", "utf8")));
    if (url === "/api/status") return json({ demo: true, agent: false });
    return json({});
  }));
});
afterEach(async () => { await act(async () => { root.unmount(); }); vi.unstubAllGlobals(); });

async function open(search: string) {
  history.replaceState({}, "", `/studio${search}`);
  await act(async () => { root.render(createElement(StudioProvider, null, createElement(Studio))); });
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
}

describe("public showcases", () => {
  it("loads the Midsummer production by name and opens on the cast wall", async () => {
    await open("?showcase=midsummer&public=1");
    expect(requested).toContain("/showcase/midsummer/production.json");
    expect(document.body.textContent).toContain("A Midsummer Night's Dream");
    expect(document.querySelectorAll('[aria-label="Cast wall"] li')).toHaveLength(15);
    expect(document.body.textContent).toContain("Fictional performers, vendors and prices");
  });

  it("keeps the Gatsby showcase at showcase=1", async () => {
    await open("?showcase=1&public=1");
    expect(requested).toContain("/showcase/production.json");
    expect(document.body.textContent).toContain("The Great Gatsby");
    expect(document.body.textContent).toContain("3 looks · 3 performers · 1 scene");
  });
});
