import { toJsonSchema } from "@valibot/to-json-schema";
import type { GenericSchema } from "valibot";
import type { OpenAPIV3 } from "openapi-types";
import { manifestContent } from "@skmtc/core/Manifest";
import { generationMapEntry, sidecarSchema } from "@skmtc/core/Anchors";
import {
  postArtifactsBody,
  toV3JsonBody,
  validateBody,
} from "./requestSchemas.ts";

/**
 * Builds the stack server's own published OpenAPI 3.1 contract — the full public
 * surface of a deployed `@skmtc/server` bundle (every route it serves), so the
 * CLI, the preview container and third parties can generate a typed client
 * against a running server. `openapi.test.ts` derives its expectation from the
 * app's own route table, so a route added to `createServer` and not documented
 * here fails the test.
 *
 * This is the AUTHORITATIVE source-of-truth spec (plan §9.2). It differs from the
 * hub's `StackServerApi` contract, which documents only the three routes the hub
 * proxies publicly (`/artifacts`, `/subjects`, `/validate`) and models payloads
 * at the hub's altitude. Here the request bodies and the `manifest` / `sidecars`
 * / `generationMap` payloads are DERIVED from the exact valibot schemas the
 * server validates and `@skmtc/core` produces, so the documented contract cannot
 * silently drift from the runtime. The remaining response payloads have no
 * runtime schema in core (they are function-return types), so they are modeled
 * here at a deliberate altitude — precise at the top level, open where the shape
 * is genuinely generator-specific.
 *
 * The document is a pure function of the package's own schemas — it does NOT
 * depend on the bundled generators — so it is stable per package version and
 * emitted once at build time (`deno task openapi` → `openapi.json`).
 */

/** The server-contract version — bump on a breaking change to any route's
 *  request/response shape. Independent of the `@skmtc/server` package version. */
export const SERVER_API_VERSION = "1.1.0";

type Schema = OpenAPIV3.SchemaObject;
type Ref = OpenAPIV3.ReferenceObject;

const ref = (name: string): Ref => ({ $ref: `#/components/schemas/${name}` });

const DEFS_PREFIX = "#/$defs/";

/**
 * Rewrite every `#/$defs/<key>` pointer in a converted schema to a
 * `#/components/schemas/<component>` pointer, using `names` to map each original
 * `$defs` key to its hoisted component name, so a hoisted definition resolves at
 * the OpenAPI document root instead of a (now-absent) local `$defs`.
 */
const rewriteDefsRefs = (
  node: unknown,
  names: Map<string, string>,
): unknown => {
  if (Array.isArray(node)) {
    return node.map((item) => rewriteDefsRefs(item, names));
  }
  if (node !== null && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      out[key] = key === "$ref" && typeof value === "string" &&
          value.startsWith(DEFS_PREFIX)
        ? ref(
          names.get(value.slice(DEFS_PREFIX.length)) ??
            value.slice(DEFS_PREFIX.length),
        ).$ref
        : rewriteDefsRefs(value, names);
    }
    return out;
  }
  return node;
};

/**
 * Derive OpenAPI 3.1 component schemas from a valibot schema.
 * `@valibot/to-json-schema` emits a self-contained JSON Schema (draft-07); every
 * construct our schemas use (`type`, `properties`, `required`, `items`, `anyOf`,
 * `additionalProperties`, `const`, `enum`) is valid JSON Schema 2020-12, which
 * OpenAPI 3.1 embeds directly. `errorMode: 'ignore'` degrades an unconvertible
 * sub-schema (e.g. a generator-specific `enrichments` value) to an open object
 * rather than throwing.
 *
 * A recursive schema (e.g. the manifest's `results` tree) is factored by the
 * converter into `$defs` with a self-`$ref`; those definitions are hoisted to
 * top-level components (named `<name>Def<n>`) and their pointers rewritten, so
 * the returned map can be spread straight into `components.schemas`. The `$defs`
 * keys are re-numbered to a stable local sequence — the converter assigns them
 * from a process-global counter, so its raw keys are NOT reproducible across
 * calls; the committed doc must be.
 *
 * The JSON-Schema and OpenAPI schema type systems are structurally compatible for
 * this construct set but not provably identical to the compiler, so the boundary
 * is asserted at the two `as` points below.
 */
const derive = (
  name: string,
  schema: GenericSchema,
): Record<string, Schema> => {
  const jsonSchema = toJsonSchema(schema, { errorMode: "ignore" }) as Record<
    string,
    unknown
  >;
  const { $schema: _schema, $defs, ...body } = jsonSchema;
  const defEntries = $defs !== null && typeof $defs === "object"
    ? Object.entries($defs)
    : [];
  const names = new Map(
    defEntries.map(([key], index) => [key, `${name}Def${index}`]),
  );

  const components: Record<string, Schema> = {
    [name]: rewriteDefsRefs(body, names) as Schema,
  };
  defEntries.forEach(([, definition], index) => {
    components[`${name}Def${index}`] = rewriteDefsRefs(
      definition,
      names,
    ) as Schema;
  });
  return components;
};

// --- Hand-modeled response schemas (no runtime valibot schema in core) --------

/** A schema parse / validation issue — `@skmtc/core`'s `ParseIssue`. */
const parseIssue: Schema = {
  type: "object",
  required: ["protocol", "level", "type", "location", "message"],
  properties: {
    protocol: { type: "string", enum: ["oas", "gql"] },
    level: { type: "string", enum: ["error", "warning", "debug"] },
    type: { type: "string", description: "Protocol-specific issue category." },
    location: {
      type: "string",
      description: "Document pointer / path of the issue.",
    },
    message: { type: "string" },
  },
};

/**
 * What one generator supports for the posted schema — `@skmtc/core`'s
 * `GeneratorSupport`, discriminated on `type`.
 */
const generatorSupport: Schema = {
  oneOf: [
    {
      type: "object",
      required: ["type", "operations"],
      properties: {
        type: { type: "string", enum: ["oasOperation"] },
        operations: {
          type: "array",
          items: {
            type: "object",
            required: ["path", "method"],
            properties: {
              path: { type: "string" },
              method: { type: "string" },
            },
          },
        },
      },
    },
    {
      type: "object",
      required: ["type", "webhooks"],
      properties: {
        type: { type: "string", enum: ["webhook"] },
        webhooks: {
          type: "array",
          items: {
            type: "object",
            required: ["name", "method"],
            properties: {
              name: { type: "string" },
              method: { type: "string" },
            },
          },
        },
      },
    },
    {
      type: "object",
      required: ["type", "operations"],
      properties: {
        type: { type: "string", enum: ["gqlOperation"] },
        operations: {
          type: "array",
          items: {
            type: "object",
            required: ["rootKind", "fieldName"],
            properties: {
              rootKind: { type: "string" },
              fieldName: { type: "string" },
            },
          },
        },
      },
    },
    {
      type: "object",
      required: ["type", "models"],
      properties: {
        type: { type: "string", enum: ["model"] },
        models: { type: "array", items: { type: "string" } },
      },
    },
  ],
};

/** One enrichment-config problem — `@skmtc/core`'s `EnrichmentValidationIssue`. */
const enrichmentValidationIssue: Schema = {
  type: "object",
  required: ["generator", "scope", "message"],
  properties: {
    generator: {
      type: "string",
      description: "Generator id, e.g. `@skmtc/gen-zod`.",
    },
    scope: { type: "string", enum: ["stack", "generator", "subject"] },
    subject: {
      type: "string",
      description: "Operation path or model ref the issue is scoped to.",
    },
    method: { type: "string" },
    variant: { type: "string" },
    field: { type: "string" },
    message: { type: "string" },
  },
};

/**
 * The form-renderable descriptor for one generator's enrichment schema —
 * `@skmtc/core`'s enrichment descriptor. The per-field shape is
 * generator-specific, so `fields` is modeled at the top level and left open
 * within.
 */
const enrichmentDescriptor: Schema = {
  type: "object",
  required: ["generator", "subjectType", "fields"],
  properties: {
    generator: { type: "string", description: "Generator id." },
    subjectType: {
      type: "string",
      description:
        "Subject kind the generator enriches, e.g. `model` or `operation`.",
    },
    fields: {
      type: "array",
      description:
        "Renderable field descriptors (key, type, and field-kind specifics).",
      items: { type: "object", additionalProperties: true },
    },
  },
};

/** Echo of a fetched `source` input — the reproducibility receipt. */
const resolvedSource: Schema = {
  type: "object",
  required: ["url", "resolvedUrl", "digest"],
  description:
    "Present when the request used `source`: the URL as requested, the final " +
    "URL after redirects (keep this one — when the source redirects to a " +
    "content-addressed form it pins the exact document), and a " +
    "`sha256:<hex>` digest of the fetched bytes.",
  properties: {
    url: { type: "string", description: "The `source` URL as requested." },
    resolvedUrl: {
      type: "string",
      description: "The final URL after redirects.",
    },
    digest: {
      type: "string",
      description: "`sha256:<hex>` digest of the fetched bytes.",
    },
  },
};

/** The structured error body every non-200 response carries. */
const errorResponse: Schema = {
  type: "object",
  required: ["error", "message"],
  properties: {
    error: {
      type: "string",
      enum: [
        "invalid_request",
        "source_fetch_failed",
        "invalid_schema",
        "internal_error",
      ],
      description: "Machine-readable error code.",
    },
    message: { type: "string", description: "What went wrong, actionably." },
    issues: {
      type: "array",
      description: "Field-level validation issues (`invalid_request` only).",
      items: {
        type: "object",
        required: ["message"],
        properties: {
          path: {
            type: "string",
            description: "Dot path of the offending field.",
          },
          message: { type: "string" },
        },
      },
    },
  },
};

// --- Response envelopes -------------------------------------------------------

const artifactsResponse = (): Schema => ({
  type: "object",
  required: ["artifacts", "manifest"],
  properties: {
    artifacts: {
      type: "object",
      additionalProperties: { type: "string" },
      description: "Generated file contents keyed by output path.",
    },
    manifest: ref("Manifest"),
    sidecars: {
      type: "object",
      additionalProperties: ref("Sidecar"),
      description: "Per-file attribution sidecars keyed by output path.",
    },
    generationMap: {
      type: "array",
      items: ref("GenerationMapEntry"),
      description:
        "Per-Definition generation-map index (file → schema origin).",
    },
    source: ref("ResolvedSource"),
  },
});

const subjectsResponse: Schema = {
  type: "object",
  required: ["subjects", "parseIssues"],
  properties: {
    subjects: {
      type: "object",
      additionalProperties: ref("GeneratorSupport"),
      description: "Supported subjects keyed by generator id.",
    },
    parseIssues: { type: "array", items: ref("ParseIssue") },
  },
};

const enrichmentDefaultsResponse: Schema = {
  type: "object",
  required: ["enrichmentDefaults", "parseIssues"],
  properties: {
    enrichmentDefaults: {
      type: "object",
      additionalProperties: true,
      description:
        "Seed enrichment values, mirroring the `client.json#settings.enrichments` " +
        "subtree (subject scope): `[generatorId][path][method][variant]` for " +
        "operations, `[generatorId][refName][variant]` for models.",
    },
    parseIssues: { type: "array", items: ref("ParseIssue") },
  },
};

const descriptorsResponse: Schema = {
  type: "object",
  required: ["descriptors"],
  properties: {
    descriptors: { type: "array", items: ref("EnrichmentDescriptor") },
  },
};

const validateResponse: Schema = {
  type: "object",
  required: ["issues"],
  properties: {
    issues: { type: "array", items: ref("EnrichmentValidationIssue") },
  },
};

const generatorsResponse: Schema = {
  type: "object",
  required: ["generators"],
  properties: {
    generators: {
      type: "array",
      items: { type: "string" },
      description: "Configured generator ids in the deployed bundle.",
    },
  },
};

const toV3JsonResponse: Schema = {
  type: "object",
  required: ["schema"],
  properties: {
    schema: {
      type: "object",
      additionalProperties: true,
      description: "The input document normalized to an OpenAPI 3.0 document.",
    },
  },
};

// --- Operation helpers --------------------------------------------------------

/** A route that returns the self-description as text, not JSON. */
const textResponse = (
  description: string,
  mediaTypes: string[],
): OpenAPIV3.ResponseObject => {
  const stringSchema: Schema = { type: "string" };
  return {
    description,
    content: Object.fromEntries(
      mediaTypes.map((mediaType) => [mediaType, { schema: stringSchema }]),
    ),
  };
};

const jsonBody = (schemaRef: Ref | Schema): OpenAPIV3.RequestBodyObject => ({
  required: true,
  content: { "application/json": { schema: schemaRef } },
});

const jsonResponse = (
  description: string,
  schema: Ref | Schema,
): OpenAPIV3.ResponseObject => ({
  description,
  content: { "application/json": { schema } },
});

/** The error responses a route can return, all carrying the structured
 *  `ErrorResponse` body: 400 for a body that fails validation (with
 *  field-level `issues`), 422 for a `source` that could not be fetched or a
 *  document that could not be read at all. A document that reads but has
 *  problems is NOT an error — it returns 200 with `manifest.parseIssues`. */
const errorResponses: OpenAPIV3.ResponsesObject = {
  "400": jsonResponse(
    "Malformed request — invalid JSON body or failed validation.",
    ref("ErrorResponse"),
  ),
  "422": jsonResponse(
    "Unprocessable — the `source` could not be fetched, or the document " +
      "could not be read as a schema.",
    ref("ErrorResponse"),
  ),
};

/**
 * Assemble the OpenAPI 3.1 document. Pure — safe to call at build time or in a
 * test. The request bodies and the manifest/sidecar/generationMap payloads are
 * derived from the live valibot schemas; the rest are modeled here.
 */
export const buildOpenApiDocument = (): OpenAPIV3.Document => ({
  openapi: "3.1.0",
  info: {
    title: "skmtc stack server",
    version: SERVER_API_VERSION,
    description:
      "The public API of a deployed @skmtc/server bundle: generate code from an " +
      "OpenAPI/GraphQL schema against the bundled generator stack, plus schema, " +
      "capability and enrichment introspection. Codegen is a pure function of " +
      "(bundle, schema, client settings).",
  },
  paths: {
    "/": {
      get: {
        operationId: "homePage",
        summary: "The server's self-description",
        description:
          "Content-negotiated on `Accept`: a browser (`text/html`) gets the " +
          "HTML page, anything else the flat markdown contract — the same " +
          "text `/index.md` and `/llms.txt` serve.",
        responses: {
          "200": textResponse("The self-description.", [
            "text/html",
            "text/markdown",
          ]),
        },
      },
    },
    "/index.md": {
      get: {
        operationId: "homePageMarkdown",
        summary: "The self-description as markdown",
        description: "The markdown variant of `/`, unconditionally.",
        responses: {
          "200": textResponse("The self-description, as markdown.", [
            "text/markdown",
          ]),
        },
      },
    },
    "/llms.txt": {
      get: {
        operationId: "homePageLlmsTxt",
        summary: "The self-description at the llms.txt convention path",
        description:
          "The same markdown as `/index.md`, at the path agents look for.",
        responses: {
          "200": textResponse("The self-description, as markdown.", [
            "text/plain",
          ]),
        },
      },
    },
    "/artifacts": {
      post: {
        operationId: "generateArtifacts",
        summary: "Generate code artifacts from a schema",
        description:
          "Parse → transform → render the schema through the bundled " +
          "generators, returning the generated files, the run manifest, and the " +
          "attribution sidecars + generation map. The schema arrives inline " +
          "(`schema`) or by URL (`source` — fetched by the server, echoed back " +
          "with its resolved URL and content digest); `protocol` is inferred " +
          "from the document when omitted.",
        requestBody: jsonBody(ref("ArtifactsRequest")),
        responses: {
          "200": jsonResponse(
            "Generated artifacts + manifest + attribution.",
            artifactsResponse(),
          ),
          ...errorResponses,
        },
      },
    },
    "/subjects": {
      post: {
        operationId: "supportedSubjects",
        summary: "Which subjects each generator supports",
        description:
          "Parse + each generator’s `isSupported` only — no transform, no render.",
        requestBody: jsonBody(ref("ArtifactsRequest")),
        responses: {
          "200": jsonResponse(
            "Per-generator supported subjects + parse issues.",
            subjectsResponse,
          ),
          ...errorResponses,
        },
      },
    },
    "/enrichment-defaults": {
      post: {
        operationId: "enrichmentDefaults",
        summary: "Seed enrichment values derived from a schema",
        description:
          "The default enrichment values each generator derives from the schema " +
          '(the "Generate fields from schema" payload) — Parse + `toEnrichmentDefaults` ' +
          "over supported subjects, no transform, no render.",
        requestBody: jsonBody(ref("ArtifactsRequest")),
        responses: {
          "200": jsonResponse(
            "Seed enrichment values + parse issues.",
            enrichmentDefaultsResponse,
          ),
          ...errorResponses,
        },
      },
    },
    "/generators": {
      get: {
        operationId: "listGenerators",
        summary: "List the configured generator ids",
        description:
          "A pure function of the bundled generators — no schema, no parse.",
        responses: {
          "200": jsonResponse(
            "The configured generator ids.",
            generatorsResponse,
          ),
        },
      },
    },
    "/descriptors": {
      post: {
        operationId: "enrichmentDescriptors",
        summary: "Form-renderable enrichment descriptors",
        description:
          "The renderable descriptor for each generator’s enrichment schema — a pure " +
          "function of the bundled generators (no schema, no parse), safe to cache per " +
          "bundle. POST with no body.",
        responses: {
          "200": jsonResponse(
            "One descriptor per configured generator.",
            descriptorsResponse,
          ),
          ...errorResponses,
        },
      },
    },
    "/validate": {
      post: {
        operationId: "validateEnrichments",
        summary: "Validate an enrichment config against the stack",
        description:
          "The authoritative verdict on whether the posted `clientSettings.enrichments` " +
          "satisfy each generator’s enrichment schema. Documentless — no schema needed.",
        requestBody: jsonBody(ref("ValidateRequest")),
        responses: {
          "200": jsonResponse(
            "Validation issues (empty when the config is valid).",
            validateResponse,
          ),
          ...errorResponses,
        },
      },
    },
    "/to-v3-json": {
      post: {
        operationId: "toV3Json",
        summary: "Normalize a schema document to OpenAPI 3.0",
        description:
          "Convert a Swagger 2.0 document to OpenAPI 3.0; 3.0 / 3.1 documents pass " +
          "through unchanged. The same normalization the `oas` generate path runs.",
        requestBody: jsonBody(ref("ToV3JsonRequest")),
        responses: {
          "200": jsonResponse(
            "The normalized OpenAPI 3.0 document.",
            toV3JsonResponse,
          ),
          ...errorResponses,
        },
      },
    },
    "/openapi.json": {
      get: {
        operationId: "openApiDocument",
        summary: "This contract",
        description:
          "The server's own OpenAPI 3.1 document — the one you are reading. " +
          "Served as a committed static artifact, so it is a pure function of " +
          "the package version.",
        responses: {
          "200": jsonResponse("This OpenAPI document.", {
            type: "object",
            additionalProperties: true,
          }),
        },
      },
    },
  },
  components: {
    schemas: {
      // Derived from the runtime valibot schemas — cannot drift from the server.
      ...derive("ArtifactsRequest", postArtifactsBody),
      ...derive("ValidateRequest", validateBody),
      ...derive("ToV3JsonRequest", toV3JsonBody),
      ...derive("Manifest", manifestContent),
      ...derive("Sidecar", sidecarSchema),
      ...derive("GenerationMapEntry", generationMapEntry),
      // Modeled — these payloads are function-return types with no runtime schema.
      ParseIssue: parseIssue,
      GeneratorSupport: generatorSupport,
      EnrichmentDescriptor: enrichmentDescriptor,
      EnrichmentValidationIssue: enrichmentValidationIssue,
      ResolvedSource: resolvedSource,
      ErrorResponse: errorResponse,
    },
  },
});
