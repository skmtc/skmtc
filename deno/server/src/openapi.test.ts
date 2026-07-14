import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.10";
import { buildOpenApiDocument } from "./openapi.ts";
import { createServer } from "./createServer.ts";

/** Collect every `$ref` string anywhere in the document. */
const collectRefs = (node: unknown, acc: string[] = []): string[] => {
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, acc);
  } else if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string") acc.push(value);
      else collectRefs(value, acc);
    }
  }
  return acc;
};

const EXPECTED_PATHS = [
  "/artifacts",
  "/subjects",
  "/enrichment-defaults",
  "/generators",
  "/descriptors",
  "/validate",
  "/to-v3-json",
];

Deno.test("buildOpenApiDocument - documents every route the server serves", () => {
  const doc = buildOpenApiDocument();
  assertEquals(doc.openapi, "3.1.0");
  assertEquals(Object.keys(doc.paths ?? {}).sort(), [...EXPECTED_PATHS].sort());
});

Deno.test("buildOpenApiDocument - request bodies are derived from the valibot schemas", () => {
  const doc = buildOpenApiDocument();
  const artifactsRequest = doc.components?.schemas?.ArtifactsRequest;
  // The `postArtifactsBody` variant converts to an `anyOf` over the oas/gql
  // branches — proof the request schema came from the runtime validator, not a
  // hand-written stub.
  assertExists(artifactsRequest);
  assertEquals("anyOf" in artifactsRequest, true);
});

Deno.test("buildOpenApiDocument - every $ref resolves to a component", () => {
  const doc = buildOpenApiDocument();
  const schemas = new Set(Object.keys(doc.components?.schemas ?? {}));
  const refs = collectRefs(doc);
  assertEquals(refs.length > 0, true);
  const dangling = refs.filter((r) =>
    !schemas.has(r.replace("#/components/schemas/", ""))
  );
  assertEquals(dangling, []);
});

Deno.test("GET /openapi.json - serves the committed contract", async () => {
  const app = createServer({ toGeneratorConfigMap: () => ({}) });
  const res = await app.request("/openapi.json");
  assertEquals(res.status, 200);
  const doc = await res.json();
  assertEquals(doc.openapi, "3.1.0");
  assertEquals(Object.keys(doc.paths).sort(), [...EXPECTED_PATHS].sort());
});

Deno.test("openapi.json - committed artifact is in sync with the source schemas", async () => {
  const committed = await Deno.readTextFile(
    new URL("../openapi.json", import.meta.url),
  );
  const rendered = `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`;
  // If this fails, run `deno task openapi` and commit the result.
  assertEquals(committed, rendered);
});
