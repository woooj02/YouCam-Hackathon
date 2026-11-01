/**
 * ENCORE's production model. Everything the planner, the renderer and the UI
 * share. Plain JSON so a whole production saves, exports and replays as-is.
 */

/** Inventory slots. Hair and makeup are styling, not stock, so they live on the Look. */
export type Slot = "base" | "outer" | "hat";
export const SLOTS: Slot[] = ["base", "outer", "hat"];

/** Clothes VTO garment categories (YouCam cloth-v4 `garment_category`). */
export type GarmentCategory = "upper_body" | "lower_body" | "full_body" | "outer" | "auto";

export type ItemSource = "owned" | "rental" | "shop";

export type Item = {
  id: string;
  name: string;
  slot: Slot;
  garmentCategory: GarmentCategory;
  colors: string[];
  tags: string[];
  /** Sizes this piece fits, as the wardrobe team entered them. "OS" = one size. */
  sizes: string[];
  qty: number;
  source: ItemSource;
  /** owned: 0; rental: fee per unit for the run; shop: price per unit. */
  cost: number;
  vendor?: string;
  /** Reference photo used for try-on (data URL, /public path, or https URL). */
  image?: string;
  available: boolean;
  condition?: string;
  notes?: string;
};

export type Performer = {
  id: string;
  name: string;
  size: string;
  /** Full-body photo for clothing try-on. */
  bodyPhoto?: string;
  /** Close-up for hair and makeup. */
  portraitPhoto?: string;
  /** Bumped whenever a photo changes, so renders re-key without hashing megabytes. */
  photoVersion: number;
  /** Which cut the Hat Try-On fits headwear to. */
  hatFit?: "male" | "female";
  reference?: "provided" | "fictional";
  /** Display framing only; the source photo and render are unchanged. */
  bodyFraming?: { zoom: number; x: number; y: number };
};

export type Role = { id: string; name: string; performerId: string; summary: string };

export type Scene = { id: string; name: string; order: number };

export type Requirement = { slot: Slot; tags: string[]; colors?: string[]; optional?: boolean };

export type MakeupSpec = {
  lip?: { color: string; texture: "matte" | "satin" | "gloss"; intensity?: number };
  foundation?: { color: string; coverage: number; glow?: number };
  smooth?: number;
  label: string;
};

export type HairSpec = { templateId: string; label: string; thumb?: string; keepColor: boolean };

export type Look = {
  id: string;
  roleId: string;
  name: string;
  sceneIds: string[];
  requirements: Requirement[];
  hair?: HairSpec;
  makeup?: MakeupSpec;
  locked: boolean;
  direction?: string;
};

export type Assignment = Record<string, Partial<Record<Slot, string>>>;

export type Gap = { lookId: string; slot: Slot; need: string };

export type Conflict = {
  kind: "double-booked" | "over-budget" | "tight-handoff" | "size";
  itemId?: string;
  lookIds: string[];
  sceneId?: string;
  message: string;
  severity: "hard" | "soft";
};

export type BasketLine = { itemId: string; units: number; unitCost: number; total: number; source: ItemSource; vendor?: string };

export type Plan = {
  assignment: Assignment;
  score: number;
  cost: number;
  basket: BasketLine[];
  gaps: Gap[];
  conflicts: Conflict[];
  nodes: number;
  ms: number;
};

export type RenderStatus = "queued" | "running" | "done" | "error";

export type RenderRecord = {
  key: string;
  lookId: string;
  stage: StageId;
  status: RenderStatus;
  taskId?: string;
  url?: string;
  error?: string;
  demo?: boolean;
  startedAt?: number;
  finishedAt?: number;
  units?: number;
  creationPending?: boolean;
};

export type StageId = "base" | "outer" | "hair" | "makeup" | "hat";

export type HistoryEvent = { at: number; kind: "plan" | "replan" | "render" | "edit" | "agent"; text: string; lookIds?: string[] };

export type Production = {
  id: string;
  title: string;
  logline: string;
  brief: string;
  budget: number;
  currency: string;
  performers: Performer[];
  roles: Role[];
  scenes: Scene[];
  looks: Look[];
  /** The rack: owned stock plus rentals already on hand. */
  inventory: Item[];
  /** Partner feed: what can be rented or bought to fill gaps. */
  shop: Item[];
  plan: Plan | null;
  renders: Record<string, RenderRecord>;
  history: HistoryEvent[];
  notice?: string;
};
