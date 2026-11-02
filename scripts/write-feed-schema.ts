/** Regenerate docs/catalogue-feed.schema.json from the zod schema: npm run feed:schema */
import { writeFileSync } from "node:fs";
import { catalogueFeedJsonSchema } from "../lib/catalogue/feed.ts";
writeFileSync("docs/catalogue-feed.schema.json", JSON.stringify(catalogueFeedJsonSchema(), null, 2) + "\n");
console.log("Wrote docs/catalogue-feed.schema.json");
