"use client";
import type { Item } from "@/lib/engine/types";
import { swatchFor } from "@/lib/sketch";

export function ItemImage({ item, className }: { item: Item; className?: string }) {
  const fallback = swatchFor(item);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={item.image || fallback} alt={item.name} className={className} onError={(event) => { if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback; }} />;
}
