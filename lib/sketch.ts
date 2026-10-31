/**
 * Demo-mode "costume sketches": when no YouCam key is set, each render stage
 * draws a fashion-plate style SVG from the planned pieces' colours instead of
 * calling the API. Clearly labelled as a sketch everywhere it appears; real
 * renders replace it as soon as a key is present.
 */
import type { Item, Look, Production, StageId } from "./engine/types";

const COLOR: Record<string, string> = {
  navy: "#22325c", charcoal: "#3b3d42", grey: "#8a8d93", gray: "#8a8d93", cream: "#e9dcc2", silver: "#c9ccd3",
  emerald: "#1f7a5a", green: "#4f7f52", ivory: "#efe6d2", white: "#f2efe9", black: "#151515", brown: "#6b4a32",
  red: "#8e1b2b", burgundy: "#6d1f2e", gold: "#c9a24a", blue: "#2f5d9e", pink: "#d48ca0", purple: "#5e3b7a",
};
const hexOf = (it?: Item) => (it ? COLOR[it.colors[0]?.toLowerCase()] ?? "#7a6f63" : undefined);

const SKIN = ["#e6c2a6", "#c99a7e", "#8d5e44", "#f0d2bd", "#a87459"];

function svgUrl(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function sketchFor(p: Production, look: Look, stage: StageId): string {
  const a = p.plan?.assignment[look.id] ?? {};
  const find = (id?: string) => (id ? [...p.inventory, ...p.shop].find((i) => i.id === id) : undefined);
  const role = p.roles.find((r) => r.id === look.roleId);
  const perfIdx = Math.max(0, p.performers.findIndex((x) => x.id === role?.performerId));
  const skin = SKIN[perfIdx % SKIN.length];
  const base = hexOf(find(a.base));
  const outer = stage === "base" ? undefined : hexOf(find(a.outer));
  const hat = hexOf(find(a.hat));
  const baseItem = find(a.base);
  const dress = baseItem?.garmentCategory === "full_body" && /dress|gown/.test(baseItem.tags.join(" ") + baseItem.name.toLowerCase());

  if (stage === "base" || stage === "outer") {
    const skirt = dress
      ? `<path d="M128 214 L96 420 Q160 436 224 420 L192 214 Z" fill="${base}"/>`
      : `<path d="M132 230 L120 420 L152 420 L160 270 L168 420 L200 420 L188 230 Z" fill="${base ? shade(base, -0.35) : "#333"}"/>`;
    return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 480">
<defs><radialGradient id="g" cx="50%" cy="20%" r="80%"><stop offset="0" stop-color="#3a2c1c"/><stop offset="1" stop-color="#0d0b0a"/></radialGradient></defs>
<rect width="320" height="480" fill="url(#g)"/>
<ellipse cx="160" cy="440" rx="90" ry="10" fill="#000" opacity=".45"/>
<circle cx="160" cy="92" r="30" fill="${skin}"/>
<rect x="150" y="118" width="20" height="18" fill="${skin}"/>
${skirt}
<path d="M120 136 Q160 126 200 136 L196 236 L124 236 Z" fill="${base ?? "#555"}"/>
<path d="M120 140 L98 250 L110 254 L130 160 Z M200 140 L222 250 L210 254 L190 160 Z" fill="${base ?? "#555"}"/>
${outer ? `<path d="M116 134 Q160 122 204 134 L214 330 L180 336 L170 160 L150 160 L140 336 L106 330 Z" fill="${outer}" opacity=".96"/><path d="M116 136 L92 256 L106 260 L128 162 Z M204 136 L228 256 L214 260 L192 162 Z" fill="${outer}"/>` : ""}
${hat ? `<path d="M124 70 Q160 40 196 70 L200 78 L120 78 Z" fill="${hat}"/><rect x="112" y="76" width="96" height="8" rx="4" fill="${shade(hat, -0.2)}"/>` : `<path d="M130 86 Q160 46 190 86 Q186 66 160 60 Q134 66 130 86 Z" fill="#2b1d14"/>`}
</svg>`);
  }

  const lip = look.makeup?.lip?.color ?? "#a5585f";
  const face = look.makeup?.foundation?.color ?? skin;
  const hairColor = "#2b1d14";
  const showHat = stage === "hat" && hat;
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
<defs><radialGradient id="g" cx="50%" cy="30%" r="75%"><stop offset="0" stop-color="#3a2c1c"/><stop offset="1" stop-color="#0d0b0a"/></radialGradient></defs>
<rect width="320" height="320" fill="url(#g)"/>
<path d="M90 300 Q160 220 230 300 Z" fill="${base ?? "#444"}"/>
<rect x="146" y="196" width="28" height="40" fill="${face}"/>
<path d="M98 150 Q100 70 160 64 Q220 70 222 150 Q226 200 204 214 L116 214 Q94 200 98 150 Z" fill="${hairColor}"/>
<ellipse cx="160" cy="150" rx="52" ry="64" fill="${face}"/>
<path d="M108 128 Q120 76 160 74 Q200 76 212 128 Q196 98 160 96 Q124 98 108 128 Z" fill="${hairColor}"/>
<path d="M134 136 q8 -5 16 0 M170 136 q8 -5 16 0" stroke="#2a1a12" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M146 184 Q160 194 174 184 Q160 178 146 184 Z" fill="${lip}"/>
${showHat ? `<path d="M100 104 Q160 40 220 104 L226 112 L94 112 Z" fill="${hat}"/><rect x="82" y="108" width="156" height="10" rx="5" fill="${shade(hat!, -0.2)}"/>` : ""}
</svg>`);
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(Math.max(0, Math.min(255, k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, "0")).join("")}`;
}

/** A flat swatch for rack pieces without a photo yet. */
export function swatchFor(item: Item): string {
  const c = hexOf(item) ?? "#7a6f63";
  const icon =
    item.slot === "hat"
      ? `<path d="M30 62 Q50 30 70 62 Z" fill="${c}"/><rect x="22" y="60" width="56" height="8" rx="4" fill="${shade(c, -0.25)}"/>`
      : item.slot === "outer"
        ? `<path d="M34 20 L50 28 L66 20 L80 30 L74 52 L68 50 L68 88 L32 88 L32 50 L26 52 L20 30 Z" fill="${c}"/><path d="M50 28 L50 88" stroke="${shade(c, -0.35)}" stroke-width="2"/>`
        : `<path d="M36 22 L64 22 L70 40 L76 86 L24 86 L30 40 Z" fill="${c}"/>`;
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#1d1813"/>${icon}</svg>`);
}
