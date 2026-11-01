import { expect, it, vi } from "vitest";
vi.mock("@/lib/youcam/client", () => ({ isDemoMode: () => false, listTemplates: vi.fn() }));
vi.mock("@/lib/http", () => ({ errorResponse: () => new Response(null, { status: 500 }) }));
import { listTemplates } from "@/lib/youcam/client";
import { GET } from "@/app/api/youcam/templates/route";

it("loads all hairstyle pages and reuses the catalogue without repeating account requests", async () => {
  vi.mocked(listTemplates).mockResolvedValueOnce({ data: { templates: [{ id: "first", title: "First" }], next_token: "second-page" } });
  vi.mocked(listTemplates).mockResolvedValueOnce({ data: { templates: [{ id: "later", title: "Later style" }] } });
  const response = await GET(new Request("http://localhost/api/youcam/templates?feature=hair-transfer"));
  expect((await response.json()).templates.map((item: { id: string }) => item.id)).toEqual(["first", "later"]);
  expect(listTemplates).toHaveBeenNthCalledWith(2, "hair-transfer", 20, "second-page");
  await GET(new Request("http://localhost/api/youcam/templates?feature=hair-transfer"));
  expect(listTemplates).toHaveBeenCalledTimes(2);
});
