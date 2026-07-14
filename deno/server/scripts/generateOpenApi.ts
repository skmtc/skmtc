/**
 * Emits `deno/server/openapi.json` from `buildOpenApiDocument()`.
 *
 *   deno task openapi          # write the committed artifact
 *   deno task openapi:check    # fail (exit 1) if the artifact is stale
 *
 * `createServer` serves the committed JSON, so the converter never enters the
 * deployed bundle; this script (and the `openapi:check` CI gate) keeps the
 * committed file in sync with the source schemas.
 */
import { buildOpenApiDocument } from "../src/openapi.ts";

const outUrl = new URL("../openapi.json", import.meta.url);
const rendered = `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`;
const check = Deno.args.includes("--check");

if (check) {
  const existing = await Deno.readTextFile(outUrl).catch(() => "");
  if (existing !== rendered) {
    console.error(
      "openapi.json is out of date. Run `deno task openapi` and commit the result.",
    );
    Deno.exit(1);
  }
  console.log("openapi.json is up to date.");
} else {
  await Deno.writeTextFile(outUrl, rendered);
  console.log(`Wrote ${outUrl.pathname}`);
}
