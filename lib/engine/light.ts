import type { Production } from "./types";

/** Strip photos and renders: planning needs the structure, not the pixels. */
export function lightweight(p: Production): Production {
  const strip = <T extends { image?: string }>(x: T) => ({ ...x, image: x.image ? "photo" : undefined });
  return {
    ...p,
    performers: p.performers.map((x) => ({ ...x, bodyPhoto: undefined, portraitPhoto: undefined })),
    inventory: p.inventory.map(strip),
    shop: p.shop.map(strip),
    renders: {},
    history: p.history.slice(-10),
  };
}
