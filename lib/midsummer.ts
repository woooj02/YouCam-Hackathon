/**
 * The large public showcase: A Midsummer Night's Dream (public domain), staged
 * as a 1920s country-house wedding. Ten fictional performers, four scenes, one
 * shared rack and a hire / buy / secondhand catalogue.
 *
 * Built so the problems a real wardrobe team hits appear on their own:
 *   - one black dinner jacket, wanted by the Duke and both suitors in the same scenes;
 *   - one ivory beaded gown, wanted by Hippolyta and Hermia at the same wedding;
 *   - Helena is a size L, so most of the rack doesn't fit her;
 *   - Elliot doubles Oberon and Theseus, and Ama doubles Titania and Hippolyta,
 *     with a quick change between the wood and the wedding;
 *   - one $180 budget across hire, purchase and secondhand.
 *
 * Every performer, vendor and price here is fictional. Photos are generated
 * with YouCam text-to-image by scripts/generate-showcase.ts and listed in
 * lib/midsummer-assets.ts; until then the studio shows labelled swatches.
 */
import type { Item, Look, Performer, Production } from "./engine/types";
import { midsummerAssets as assets } from "./midsummer-assets.ts";

const img = (id: string): string | undefined => (assets as Record<string, string>)[id];

const owned = (i: Omit<Item, "source" | "cost" | "available" | "qty" | "image"> & { qty?: number }): Item =>
  ({ qty: 1, ...i, source: "owned", cost: 0, available: true, image: img(i.id) });
const hire = (i: Omit<Item, "source" | "available" | "vendor" | "image">): Item =>
  ({ ...i, source: "rental", vendor: "Limelight Costume Hire (fictional)", available: true, image: img(i.id) });
const buy = (i: Omit<Item, "source" | "available" | "vendor" | "image">): Item =>
  ({ ...i, source: "shop", vendor: "Stagecraft Supply (fictional)", available: true, image: img(i.id) });
const secondhand = (i: Omit<Item, "source" | "available" | "vendor" | "image">): Item =>
  ({ ...i, source: "secondhand", vendor: "Encore Thrift (fictional)", available: true, image: img(i.id) });

const performer = (id: string, name: string, size: string, hatFit: "male" | "female"): Performer =>
  ({ id, name, size, hatFit, photoVersion: 1, reference: "fictional", bodyPhoto: img(`${id}-body`) });

const look = (l: Omit<Look, "locked">): Look => ({ ...l, locked: false });

export function midsummerProduction(): Production {
  return {
    id: "midsummer-1926",
    title: "A Midsummer Night's Dream",
    logline: "A 1920s country-house wedding · 10 performers · 15 looks · one $180 costume budget",
    brief: "Shakespeare's comedy (public domain) moved to a 1926 country-house wedding. The court dresses for a garden party; the wood is moonlit and strange; the wedding feast is white tie. Elliot doubles Theseus and Oberon, Ama doubles Hippolyta and Titania, with a quick change from the wood to the wedding. Reuse the rack first, hire before buying, and stay inside $180.",
    notice: "Fictional performers, vendors and prices. A Midsummer Night's Dream is public domain; this staging is original to the demo.",
    budget: 180,
    currency: "$",
    completeLook: { strategy: "direct" },
    performers: [
      performer("p-elliot", "Elliot", "M", "male"),
      performer("p-ama", "Ama", "M", "female"),
      performer("p-lena", "Lena", "S", "female"),
      performer("p-grace", "Grace", "L", "female"),
      performer("p-rafael", "Rafael", "M", "male"),
      performer("p-tom", "Tom", "L", "male"),
      performer("p-juniper", "Juniper", "S", "female"),
      performer("p-marcus", "Marcus", "XL", "male"),
      performer("p-ruth", "Ruth", "M", "female"),
      performer("p-sam", "Sam", "S", "male"),
    ],
    roles: [
      { id: "r-theseus", name: "Theseus", performerId: "p-elliot", summary: "The Duke: assured, formal, the host of the wedding." },
      { id: "r-oberon", name: "Oberon", performerId: "p-elliot", summary: "King of the fairies: midnight velvet, a little dangerous." },
      { id: "r-hippolyta", name: "Hippolyta", performerId: "p-ama", summary: "The Duke's bride: gold and ivory, cool and watchful." },
      { id: "r-titania", name: "Titania", performerId: "p-ama", summary: "Queen of the fairies: moonlit silver and green." },
      { id: "r-hermia", name: "Hermia", performerId: "p-lena", summary: "Small, fierce, in love with Lysander." },
      { id: "r-helena", name: "Helena", performerId: "p-grace", summary: "Tall, overlooked, in love with Demetrius." },
      { id: "r-lysander", name: "Lysander", performerId: "p-rafael", summary: "The romantic suitor." },
      { id: "r-demetrius", name: "Demetrius", performerId: "p-tom", summary: "The suitor Egeus prefers: sharper, colder." },
      { id: "r-puck", name: "Puck", performerId: "p-juniper", summary: "Oberon's servant: mischief in a waistcoat." },
      { id: "r-bottom", name: "Nick Bottom", performerId: "p-marcus", summary: "The weaver who wants every part." },
      { id: "r-quince", name: "Peter Quince", performerId: "p-ruth", summary: "The carpenter directing the play within the play." },
      { id: "r-flute", name: "Francis Flute", performerId: "p-sam", summary: "The bellows-mender, cast as Thisbe." },
    ],
    scenes: [
      { id: "court", name: "The Duke's Court", order: 1 },
      { id: "workshop", name: "Quince's Workshop", order: 2 },
      { id: "wood", name: "The Wood at Night", order: 3 },
      { id: "wedding", name: "The Wedding Feast", order: 4 },
    ],
    looks: [
      look({ id: "l-theseus", roleId: "r-theseus", name: "Theseus, the Duke", sceneIds: ["court", "wedding"],
        direction: "White-tie host: a black satin-lapel dinner jacket over an evening shirt. Swept evening hair.",
        requirements: [{ slot: "base", tags: ["formal", "shirt", "trousers"], colors: ["white", "black"] }, { slot: "outer", tags: ["dinner", "jacket", "satin", "lapel"], colors: ["black"] }],
        hair: { templateId: "male_wavy_undercut", label: "Swept evening undercut", keepColor: true },
        makeup: { label: "Stage base, matte", foundation: { color: "#c49a7c", coverage: 20, glow: 5 }, smooth: 10 } }),
      look({ id: "l-oberon", roleId: "r-oberon", name: "Oberon, in the wood", sceneIds: ["wood"],
        direction: "Midnight velvet over dark evening clothes, so the quick change to Theseus is a jacket swap.",
        requirements: [{ slot: "base", tags: ["formal", "shirt", "trousers"], colors: ["black"] }, { slot: "outer", tags: ["cape", "velvet", "evening"], colors: ["navy", "black"] }],
        hair: { templateId: "male_textured_crop", label: "Textured short crop", keepColor: true },
        makeup: { label: "Cool shadowed fairy king", foundation: { color: "#b08a74", coverage: 35, glow: 30 }, smooth: 20 } }),
      look({ id: "l-hippolyta", roleId: "r-hippolyta", name: "Hippolyta, the bride", sceneIds: ["court", "wedding"],
        direction: "Ivory and gold beadwork, a pale stole, sculpted waves and a berry lip.",
        requirements: [{ slot: "base", tags: ["gown", "evening", "1920s", "beaded"], colors: ["ivory", "gold"] }, { slot: "outer", tags: ["stole", "evening"], colors: ["ivory", "gold"], optional: true }],
        hair: { templateId: "female_retro_brown_waves", label: "1920s sculpted waves", keepColor: true },
        makeup: { label: "Berry lip, satin skin", lip: { color: "#8a2440", texture: "satin", intensity: 75 }, foundation: { color: "#8a5a40", coverage: 30, glow: 15 }, smooth: 15 } }),
      look({ id: "l-titania", roleId: "r-titania", name: "Titania, in the wood", sceneIds: ["wood"],
        direction: "Moonlit silver-green silk and a sheer cape. Sculpted waves, a cool shimmer.",
        requirements: [{ slot: "base", tags: ["gown", "silk", "evening"], colors: ["silver", "green"] }, { slot: "outer", tags: ["cape", "sheer"], colors: ["silver", "green"], optional: true }],
        hair: { templateId: "female_retro_brown_waves", label: "1920s sculpted waves", keepColor: true },
        makeup: { label: "Cool shimmer, mauve lip", lip: { color: "#8c5a7a", texture: "gloss", intensity: 60 }, foundation: { color: "#8a5a40", coverage: 25, glow: 45 }, smooth: 20 } }),
      look({ id: "l-hermia", roleId: "r-hermia", name: "Hermia, the garden party", sceneIds: ["court", "wood"],
        direction: "A rose drop-waist day dress that can take a night in the wood.",
        requirements: [{ slot: "base", tags: ["dress", "1920s", "day"], colors: ["rose", "pink"] }, { slot: "outer", tags: ["cardigan", "knit"], optional: true }],
        hair: { templateId: "female_retro_brown_waves", label: "1920s sculpted waves", keepColor: true },
        makeup: { label: "Fresh rose lip", lip: { color: "#b5546a", texture: "satin", intensity: 60 }, smooth: 15 } }),
      look({ id: "l-hermia-wed", roleId: "r-hermia", name: "Hermia, the wedding", sceneIds: ["wedding"],
        direction: "Ivory beadwork for the triple wedding.",
        requirements: [{ slot: "base", tags: ["gown", "evening", "1920s", "beaded"], colors: ["ivory"] }],
        hair: { templateId: "female_retro_brown_waves", label: "1920s sculpted waves", keepColor: true },
        makeup: { label: "Wedding: deep rose lip", lip: { color: "#9c2f4a", texture: "matte", intensity: 75 }, smooth: 20 } }),
      look({ id: "l-helena", roleId: "r-helena", name: "Helena, the garden party", sceneIds: ["court", "wood"],
        direction: "A long, pale day dress that makes her height a statement.",
        requirements: [{ slot: "base", tags: ["dress", "1920s", "day"], colors: ["blue", "ivory"] }, { slot: "outer", tags: ["cardigan", "knit"], optional: true }],
        hair: { templateId: "female_retro_brown_waves", label: "1920s sculpted waves", keepColor: true },
        makeup: { label: "Soft coral lip", lip: { color: "#c0605a", texture: "satin", intensity: 55 }, smooth: 15 } }),
      look({ id: "l-helena-wed", roleId: "r-helena", name: "Helena, the wedding", sceneIds: ["wedding"],
        direction: "Champagne or ivory evening dress, long line.",
        requirements: [{ slot: "base", tags: ["gown", "evening", "1920s"], colors: ["ivory", "champagne"] }],
        hair: { templateId: "female_retro_brown_waves", label: "1920s sculpted waves", keepColor: true },
        makeup: { label: "Wedding: warm red lip", lip: { color: "#a3333b", texture: "matte", intensity: 70 }, smooth: 20 } }),
      look({ id: "l-lysander", roleId: "r-lysander", name: "Lysander", sceneIds: ["court", "wood", "wedding"],
        direction: "A soft evening jacket; romantic, a little rumpled.",
        requirements: [{ slot: "base", tags: ["formal", "shirt", "trousers"], colors: ["white", "black"] }, { slot: "outer", tags: ["dinner", "jacket", "lapel"], colors: ["black", "navy"] }],
        hair: { templateId: "male_textured_crop", label: "Textured short crop", keepColor: true },
        makeup: { label: "Natural stage base", foundation: { color: "#a77b5d", coverage: 15, glow: 5 }, smooth: 5 } }),
      look({ id: "l-demetrius", roleId: "r-demetrius", name: "Demetrius", sceneIds: ["court", "wood", "wedding"],
        direction: "Sharper than Lysander: a black satin-lapel dinner jacket, hair swept back.",
        requirements: [{ slot: "base", tags: ["formal", "shirt", "trousers"], colors: ["white", "black"] }, { slot: "outer", tags: ["dinner", "jacket", "satin", "lapel"], colors: ["black"] }],
        hair: { templateId: "male_wavy_undercut", label: "Swept evening undercut", keepColor: true },
        makeup: { label: "Natural stage base", foundation: { color: "#d2ad92", coverage: 15, glow: 5 }, smooth: 5 } }),
      look({ id: "l-puck", roleId: "r-puck", name: "Puck", sceneIds: ["wood", "wedding"],
        direction: "A green waistcoat and shirtsleeves, so Puck can vanish at the wedding.",
        requirements: [{ slot: "base", tags: ["waistcoat", "shirt"], colors: ["green"] }],
        hair: { templateId: "male_textured_crop", label: "Textured short crop", keepColor: true },
        makeup: { label: "Freckled, green glow", foundation: { color: "#e2bfa5", coverage: 15, glow: 40 }, smooth: 10 } }),
      look({ id: "l-bottom", roleId: "r-bottom", name: "Bottom, the weaver", sceneIds: ["workshop", "wood", "wedding"],
        direction: "Brown tweed, rolled sleeves; the ass's head is a prop for the fitting.",
        requirements: [{ slot: "base", tags: ["tweed", "work", "suit"], colors: ["brown"] }, { slot: "outer", tags: ["coat", "work"], colors: ["brown"], optional: true }],
        makeup: { label: "Ruddy, weathered", foundation: { color: "#8c5b3e", coverage: 15, glow: 5 }, smooth: 0 } }),
      look({ id: "l-quince", roleId: "r-quince", name: "Quince, the director", sceneIds: ["workshop", "wedding"],
        direction: "Carpenter's work clothes and a long apron; a pencil behind the ear.",
        requirements: [{ slot: "base", tags: ["work", "shirt", "trousers"], colors: ["grey", "brown"] }, { slot: "outer", tags: ["apron", "work"], colors: ["brown"], optional: true }],
        makeup: { label: "Clean, no-nonsense", smooth: 5 } }),
      look({ id: "l-flute", roleId: "r-flute", name: "Flute, the bellows-mender", sceneIds: ["workshop"],
        direction: "Plain work shirt and trousers.",
        requirements: [{ slot: "base", tags: ["work", "shirt", "trousers"], colors: ["grey", "blue"] }],
        makeup: { label: "Bare face", smooth: 0 } }),
      look({ id: "l-thisbe", roleId: "r-flute", name: "Flute, playing Thisbe", sceneIds: ["wedding"],
        direction: "A borrowed, too-big ivory gown worn for laughs over the work clothes.",
        requirements: [{ slot: "base", tags: ["gown", "evening", "1920s"], colors: ["ivory", "white"] }],
        hair: { templateId: "female_retro_brown_waves", label: "1920s sculpted waves", keepColor: false },
        makeup: { label: "Overdrawn red lip, for comedy", lip: { color: "#c0202f", texture: "gloss", intensity: 90 }, smooth: 10 } }),
    ],
    inventory: [
      owned({ id: "m-evening-base", name: "White evening shirt & black trousers", slot: "base", garmentCategory: "full_body", colors: ["white", "black"], tags: ["formal", "shirt", "trousers", "evening"], sizes: ["M", "L"], qty: 3 }),
      owned({ id: "m-black-jacket", name: "Black satin-lapel dinner jacket", slot: "outer", garmentCategory: "outer", colors: ["black"], tags: ["dinner", "jacket", "satin", "lapel", "formal"], sizes: ["M", "L"] }),
      owned({ id: "m-navy-jacket", name: "Navy shawl-collar dinner jacket", slot: "outer", garmentCategory: "outer", colors: ["navy"], tags: ["dinner", "jacket", "lapel", "evening"], sizes: ["M"] }),
      owned({ id: "m-velvet-cape", name: "Midnight velvet cape", slot: "outer", garmentCategory: "outer", colors: ["navy"], tags: ["cape", "velvet", "evening"], sizes: ["OS"] }),
      owned({ id: "m-ivory-gown", name: "Ivory beaded wedding gown", slot: "base", garmentCategory: "full_body", colors: ["ivory", "gold"], tags: ["gown", "evening", "1920s", "beaded", "dress"], sizes: ["S", "M"] }),
      owned({ id: "m-silver-gown", name: "Silver-green silk slip gown", slot: "base", garmentCategory: "full_body", colors: ["silver", "green"], tags: ["gown", "silk", "evening", "1920s"], sizes: ["M"] }),
      owned({ id: "m-rose-dress", name: "Rose drop-waist day dress", slot: "base", garmentCategory: "full_body", colors: ["rose", "pink"], tags: ["dress", "1920s", "day"], sizes: ["S", "M"] }),
      owned({ id: "m-cream-cardigan", name: "Cream cable cardigan", slot: "outer", garmentCategory: "outer", colors: ["cream"], tags: ["cardigan", "knit"], sizes: ["S", "M"] }),
      owned({ id: "m-green-waistcoat", name: "Green waistcoat & shirtsleeves", slot: "base", garmentCategory: "upper_body", colors: ["green", "white"], tags: ["waistcoat", "shirt", "period"], sizes: ["S", "M"] }),
      owned({ id: "m-tweed-suit", name: "Brown tweed work suit", slot: "base", garmentCategory: "full_body", colors: ["brown"], tags: ["tweed", "work", "suit", "period"], sizes: ["L", "XL"] }),
      owned({ id: "m-work-shirt", name: "Grey work shirt & trousers", slot: "base", garmentCategory: "full_body", colors: ["grey"], tags: ["work", "shirt", "trousers"], sizes: ["S", "M"], qty: 2 }),
      owned({ id: "m-apron", name: "Brown canvas work apron", slot: "outer", garmentCategory: "outer", colors: ["brown"], tags: ["apron", "work"], sizes: ["OS"] }),
    ],
    shop: [
      hire({ id: "h-black-jacket", name: "Black dinner jacket (hire)", slot: "outer", garmentCategory: "outer", colors: ["black"], tags: ["dinner", "jacket", "satin", "lapel", "formal"], sizes: ["M", "L"], qty: 2, cost: 45 }),
      hire({ id: "h-gold-gown", name: "Gold beaded evening gown (hire)", slot: "base", garmentCategory: "full_body", colors: ["gold", "ivory"], tags: ["gown", "evening", "1920s", "beaded"], sizes: ["M", "L"], qty: 1, cost: 70 }),
      hire({ id: "h-ivory-stole", name: "Ivory evening stole (hire)", slot: "outer", garmentCategory: "outer", colors: ["ivory"], tags: ["stole", "evening"], sizes: ["OS"], qty: 1, cost: 20 }),
      hire({ id: "h-sheer-cape", name: "Sheer silver cape (hire)", slot: "outer", garmentCategory: "outer", colors: ["silver"], tags: ["cape", "sheer", "evening"], sizes: ["OS"], qty: 1, cost: 25 }),
      buy({ id: "b-blue-dress", name: "Powder-blue day dress, long", slot: "base", garmentCategory: "full_body", colors: ["blue"], tags: ["dress", "1920s", "day"], sizes: ["L", "XL"], qty: 2, cost: 65 }),
      buy({ id: "b-champagne-gown", name: "Champagne evening gown, new", slot: "base", garmentCategory: "full_body", colors: ["champagne"], tags: ["gown", "evening", "1920s"], sizes: ["L"], qty: 1, cost: 95 }),
      buy({ id: "b-evening-base", name: "Evening shirt & trousers, new", slot: "base", garmentCategory: "full_body", colors: ["white", "black"], tags: ["formal", "shirt", "trousers", "evening"], sizes: ["S", "M", "L", "XL"], qty: 4, cost: 40 }),
      secondhand({ id: "s-ivory-gown", name: "Ivory beaded gown, secondhand", slot: "base", garmentCategory: "full_body", colors: ["ivory"], tags: ["gown", "evening", "1920s", "beaded"], sizes: ["S", "L"], qty: 1, cost: 38 }),
      secondhand({ id: "s-white-gown", name: "White chiffon gown, secondhand", slot: "base", garmentCategory: "full_body", colors: ["white"], tags: ["gown", "evening", "1920s"], sizes: ["S", "M", "L"], qty: 1, cost: 22 }),
      secondhand({ id: "s-ivory-dress", name: "Ivory lawn day dress, secondhand", slot: "base", garmentCategory: "full_body", colors: ["ivory"], tags: ["dress", "1920s", "day"], sizes: ["L"], qty: 1, cost: 30 }),
      secondhand({ id: "s-brown-coat", name: "Brown work coat, secondhand", slot: "outer", garmentCategory: "outer", colors: ["brown"], tags: ["coat", "work"], sizes: ["L", "XL"], qty: 1, cost: 18 }),
    ],
    plan: null,
    renders: {},
    history: [],
  };
}
