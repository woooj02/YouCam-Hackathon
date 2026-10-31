/**
 * The showcase production: an original one-act, written for this demo.
 * Built so the problems real wardrobe teams hit show up on their own:
 * two characters want the same coat in the same scene, one performer doubles
 * two roles, and the budget is tight.
 *
 * Brands and shops here are fictional. Garment images are placeholders until a
 * team photographs its own rack (the intake flow tags photos with AI).
 */
import type { Item, Production } from "./engine/types";

const owned = (i: Omit<Item, "source" | "cost" | "available" | "qty"> & { qty?: number }): Item => ({
  qty: 1,
  ...i,
  source: "owned",
  cost: 0,
  available: true,
});

export const SHOWCASE_BRIEF = `THE LANTERN KEEPERS - a one-act ghost story.
A harbour town, 1924. On the night of the great storm, the lighthouse keeper's daughter Elsie
throws a masquerade to keep the town's spirits up. Captain Rowe, back from sea, wants to propose.
The Harbourmaster wants the lighthouse shut down. And one masked guest at the party drowned ten years ago.

Cast of three. Priya doubles the Harbourmaster and the Drowned Guest.
Scenes: The Harbour at Dusk / The Lamp Room / The Masquerade / The Storm / Dawn.
Look: worn wool and salt for the town; a burst of 1920s evening glamour for the masquerade;
the Guest should read as pale, sea-faded, a little wrong.
Sourcing budget: $250. Reuse the rack wherever we can.`;

export function showcaseProduction(): Production {
  return {
    id: "lantern-keepers",
    title: "The Lantern Keepers",
    logline: "A harbour town, 1924. A storm, a masquerade, and a guest who drowned ten years ago.",
    brief: SHOWCASE_BRIEF,
    budget: 250,
    currency: "$",
    performers: [
      { id: "p-maya", name: "Maya", size: "S", photoVersion: 0, hatFit: "female" },
      { id: "p-jonah", name: "Jonah", size: "L", photoVersion: 0, hatFit: "male" },
      { id: "p-priya", name: "Priya", size: "M", photoVersion: 0, hatFit: "female" },
    ],
    roles: [
      { id: "r-elsie", name: "Elsie Hart", performerId: "p-maya", summary: "The keeper's daughter. Practical by day, luminous at the party." },
      { id: "r-rowe", name: "Captain Rowe", performerId: "p-jonah", summary: "Weathered, decent, out of place in a ballroom." },
      { id: "r-quill", name: "Harbourmaster Quill", performerId: "p-priya", summary: "Brisk, official, buttoned up against the weather." },
      { id: "r-guest", name: "The Drowned Guest", performerId: "p-priya", summary: "Pale, sea-faded, elegant ten years too late." },
    ],
    scenes: [
      { id: "s1", name: "The Harbour at Dusk", order: 1 },
      { id: "s2", name: "The Lamp Room", order: 2 },
      { id: "s3", name: "The Masquerade", order: 3 },
      { id: "s4", name: "The Storm", order: 4 },
      { id: "s5", name: "Dawn", order: 5 },
    ],
    looks: [
      {
        id: "l-elsie-day", roleId: "r-elsie", name: "Elsie, working day", sceneIds: ["s1", "s2"], locked: false,
        requirements: [
          { slot: "base", tags: ["dress", "1920s", "work"], colors: ["grey", "green"] },
          { slot: "outer", tags: ["cardigan", "knit"], colors: ["cream"], optional: true },
        ],
        makeup: { label: "Fresh, wind-flushed", lip: { color: "#b5646a", texture: "satin" }, smooth: 30 },
      },
      {
        id: "l-elsie-party", roleId: "r-elsie", name: "Elsie, the masquerade", sceneIds: ["s3", "s4"], locked: false,
        requirements: [
          { slot: "base", tags: ["gown", "evening", "1920s", "beaded"], colors: ["emerald", "green"] },
          { slot: "outer", tags: ["shawl", "evening"], colors: ["silver"], optional: true },
        ],
        makeup: { label: "1920s evening: deep red lip", lip: { color: "#8e1b2b", texture: "matte" }, foundation: { color: "#e9c7b0", coverage: 45 }, smooth: 40 },
      },
      {
        id: "l-rowe-sea", roleId: "r-rowe", name: "Rowe, off the boat", sceneIds: ["s1", "s4", "s5"], locked: false,
        requirements: [
          { slot: "base", tags: ["knit", "sweater", "sea"], colors: ["cream"] },
          { slot: "outer", tags: ["long", "coat", "wool", "naval"], colors: ["navy"] },
          { slot: "hat", tags: ["cap", "captain", "naval"], colors: ["navy"] },
        ],
      },
      {
        id: "l-rowe-party", roleId: "r-rowe", name: "Rowe, in borrowed tails", sceneIds: ["s3"], locked: false,
        requirements: [{ slot: "base", tags: ["suit", "formal", "tailcoat"], colors: ["black"] }],
      },
      {
        id: "l-quill", roleId: "r-quill", name: "Quill, on duty", sceneIds: ["s1", "s2"], locked: false,
        requirements: [
          { slot: "base", tags: ["waistcoat", "tweed", "period"], colors: ["brown"] },
          { slot: "outer", tags: ["long", "coat", "period"], colors: ["navy", "charcoal"] },
          { slot: "hat", tags: ["cap", "flat"], colors: ["brown"] },
        ],
        makeup: { label: "Weathered, no-nonsense", smooth: 10 },
      },
      {
        id: "l-guest", roleId: "r-guest", name: "The Drowned Guest", sceneIds: ["s3", "s4"], locked: false,
        requirements: [
          { slot: "base", tags: ["gown", "vintage", "1920s", "pale"], colors: ["ivory", "white"] },
          { slot: "outer", tags: ["shawl", "veil", "sheer"], colors: ["grey"], optional: true },
        ],
        makeup: { label: "Sea-faded: pale, cool lip", lip: { color: "#9c8f9c", texture: "matte" }, foundation: { color: "#efe2da", coverage: 70 }, smooth: 60 },
      },
    ],
    inventory: [
      owned({ id: "i-navy-coat", name: "Navy wool greatcoat", slot: "outer", garmentCategory: "outer", colors: ["navy"], tags: ["long", "coat", "wool", "naval", "period"], sizes: ["M", "L"], image: "/rack/navy-greatcoat.jpg", condition: "Good, brass buttons" }),
      owned({ id: "i-frock-coat", name: "Charcoal frock coat", slot: "outer", garmentCategory: "outer", colors: ["charcoal"], tags: ["long", "coat", "period", "frock"], sizes: ["M"], image: "/rack/charcoal-frock-coat.jpg" }),
      owned({ id: "i-cardigan", name: "Cream cable cardigan", slot: "outer", garmentCategory: "outer", colors: ["cream"], tags: ["cardigan", "knit", "wool"], sizes: ["S", "M"], image: "/rack/cream-cardigan.jpg" }),
      owned({ id: "i-shawl", name: "Silver chiffon shawl", slot: "outer", garmentCategory: "outer", colors: ["silver"], tags: ["shawl", "evening", "chiffon"], sizes: ["OS"], image: "/rack/silver-shawl.jpg" }),
      owned({ id: "i-veil", name: "Torn grey veil wrap", slot: "outer", garmentCategory: "outer", colors: ["grey"], tags: ["shawl", "veil", "sheer", "ghostly"], sizes: ["OS"], image: "/rack/grey-veil.jpg", condition: "Distressed on purpose" }),
      owned({ id: "i-work-dress", name: "Grey linen work dress", slot: "base", garmentCategory: "full_body", colors: ["grey"], tags: ["dress", "1920s", "work", "linen"], sizes: ["S"], image: "/rack/grey-work-dress.jpg" }),
      owned({ id: "i-flapper", name: "Emerald beaded flapper dress", slot: "base", garmentCategory: "full_body", colors: ["emerald", "green"], tags: ["gown", "evening", "1920s", "beaded", "dress"], sizes: ["S", "M"], image: "/rack/emerald-flapper.jpg" }),
      owned({ id: "i-tea-gown", name: "Ivory lace tea gown", slot: "base", garmentCategory: "full_body", colors: ["ivory", "white"], tags: ["gown", "vintage", "lace", "1920s", "pale"], sizes: ["M"], image: "/rack/ivory-tea-gown.jpg" }),
      owned({ id: "i-sweater", name: "Fisherman's knit sweater", slot: "base", garmentCategory: "upper_body", colors: ["cream"], tags: ["knit", "sweater", "sea", "wool"], sizes: ["M", "L"], image: "/rack/fisherman-sweater.jpg" }),
      owned({ id: "i-tails", name: "Black tailcoat suit", slot: "base", garmentCategory: "full_body", colors: ["black"], tags: ["suit", "formal", "tailcoat", "evening"], sizes: ["L"], image: "/rack/black-tailcoat.jpg" }),
      owned({ id: "i-waistcoat", name: "Brown tweed waistcoat set", slot: "base", garmentCategory: "upper_body", colors: ["brown"], tags: ["waistcoat", "tweed", "period", "shirt"], sizes: ["M"], image: "/rack/tweed-waistcoat.jpg" }),
      owned({ id: "i-captain-cap", name: "Captain's peaked cap", slot: "hat", garmentCategory: "auto", colors: ["navy"], tags: ["cap", "captain", "naval"], sizes: ["OS"], image: "/rack/captain-cap.jpg" }),
      owned({ id: "i-flat-cap", name: "Tweed flat cap", slot: "hat", garmentCategory: "auto", colors: ["brown"], tags: ["cap", "flat", "tweed"], sizes: ["OS"], image: "/rack/flat-cap.jpg" }),
    ],
    shop: [
      { id: "x-pea-coat", name: "Naval pea coat", slot: "outer", garmentCategory: "outer", colors: ["navy"], tags: ["coat", "wool", "naval", "period"], sizes: ["L", "XL"], qty: 3, source: "rental", cost: 40, vendor: "Footlights Costume Hire", image: "/rack/navy-pea-coat.jpg", available: true },
      { id: "x-greatcoat", name: "Charcoal greatcoat", slot: "outer", garmentCategory: "outer", colors: ["charcoal"], tags: ["long", "coat", "wool", "period"], sizes: ["M", "L"], qty: 2, source: "rental", cost: 45, vendor: "Footlights Costume Hire", image: "/rack/charcoal-greatcoat.jpg", available: true },
      { id: "x-opera-cape", name: "Midnight velvet opera cape", slot: "outer", garmentCategory: "outer", colors: ["navy"], tags: ["cape", "evening", "velvet"], sizes: ["OS"], qty: 1, source: "rental", cost: 30, vendor: "Footlights Costume Hire", image: "/rack/opera-cape.jpg", available: true },
      { id: "x-sage-dress", name: "Sage drop-waist day dress", slot: "base", garmentCategory: "full_body", colors: ["green"], tags: ["dress", "1920s", "work"], sizes: ["S", "M"], qty: 1, source: "shop", cost: 28, vendor: "Second Act Vintage", image: "/rack/sage-dress.jpg", available: true },
      { id: "x-chiffon-gown", name: "Ivory chiffon gown", slot: "base", garmentCategory: "full_body", colors: ["ivory"], tags: ["gown", "pale", "vintage", "1920s"], sizes: ["S", "L"], qty: 1, source: "shop", cost: 55, vendor: "Second Act Vintage", image: "/rack/ivory-chiffon.jpg", available: true },
      { id: "x-bowler", name: "Black bowler hat", slot: "hat", garmentCategory: "auto", colors: ["black"], tags: ["hat", "bowler", "period"], sizes: ["OS"], qty: 2, source: "shop", cost: 18, vendor: "Second Act Vintage", image: "/rack/bowler.jpg", available: true },
      { id: "x-captain-cap", name: "Captain's cap, new", slot: "hat", garmentCategory: "auto", colors: ["navy"], tags: ["cap", "captain", "naval"], sizes: ["OS"], qty: 4, source: "shop", cost: 24, vendor: "Second Act Vintage", image: "/rack/captain-cap-new.jpg", available: true },
    ],
    plan: null,
    renders: {},
    history: [],
  };
}
