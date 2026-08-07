import { cors } from "hono/cors";
import { Hono } from "hono";
import {
  toArtifacts,
  toEnrichmentDefaults,
  toEnrichmentDescriptor,
  toSupportedSubjects,
  validateConfig,
} from "@skmtc/core";
import type { GeneratorsMapContainer, SkmtcDocumentInput } from "@skmtc/core";
import type { ManifestContent } from "@skmtc/core/Manifest";
import type { GenerationMapEntry, Sidecar } from "@skmtc/core/Anchors";
import { stringToSchema, toV3Document } from "@skmtc/convert";
import * as v from "valibot";
import { StackTrail } from "@skmtc/core";
import openApiDocument from "../openapi.json" with { type: "json" };
import {
  InvalidBodyError,
  postArtifactsBody,
  toV3JsonBody,
  validateBody,
} from "./requestSchemas.ts";
import type { Context } from "hono";
import {
  fetchSource,
  resolveSchemaInput,
  SchemaReadError,
  SourceFetchError,
} from "./schemaInput.ts";
import type { ResolvedSchemaInput } from "./schemaInput.ts";
import { homePageHtml, homePageMd } from "./homePage.ts";
import type { HomePageContext, StackIdentity } from "./homePage.ts";

/** Read a request body as JSON, reporting a malformed body as the typed
 *  `InvalidBodyError` (→ 400). Only the body parse is caught, so a
 *  `SyntaxError` raised anywhere below a route keeps its own meaning. */
const readJsonBody = async (c: Context): Promise<unknown> => {
  try {
    return await c.req.json();
  } catch {
    throw new InvalidBodyError("Request body is not valid JSON.");
  }
};

type GenerateResult = {
  artifacts: Record<string, string>;
  manifest: ManifestContent;
  /** Per-file attribution sidecars (byte-range → producer). Present
   *  because attribution is always enabled with a post-pass below. */
  sidecars?: Record<string, Sidecar>;
  /** Per-Definition generation-map index (file → schema origin). */
  generationMap?: GenerationMapEntry[];
};

/**
 * Build the unified `SkmtcDocumentInput` from a resolved schema input. The
 * host-side OAS normalization (Swagger 2 / 3.1 → 3.0 via `@skmtc/convert`)
 * runs here; GQL passes its SDL through unchanged. A document that cannot be
 * read at all surfaces as a `SchemaReadError` (→ structured 422), distinct
 * from a readable document with issues (→ 200 + `manifest.parseIssues`).
 */
const toDocumentInput = async (
  { protocol, schema }: ResolvedSchemaInput,
): Promise<SkmtcDocumentInput> => {
  switch (protocol) {
    case "oas": {
      try {
        return {
          type: "oas",
          value: await toV3Document(stringToSchema(schema)),
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new SchemaReadError(`Could not read OAS document: ${reason}`);
      }
    }
    case "gql": {
      return { type: "gql", value: schema };
    }
    default: {
      const _exhaustive: never = protocol;
      throw new Error(`Unhandled protocol: ${JSON.stringify(_exhaustive)}`);
    }
  }
};

type DispatchArgs = {
  resolved: ResolvedSchemaInput;
  schemaSrc: string | undefined;
  clientSettings: v.InferOutput<typeof postArtifactsBody>["clientSettings"];
  toGeneratorConfigMap: <EnrichmentType = undefined>() =>
    GeneratorsMapContainer<EnrichmentType>;
  logsPath: string | undefined;
};

/** Routes a resolved schema input to the core `toArtifacts` entry point. */
const dispatchArtifacts = async ({
  resolved,
  schemaSrc,
  clientSettings,
  toGeneratorConfigMap,
  logsPath,
}: DispatchArgs): Promise<GenerateResult> => {
  const startAt = Date.now();
  const traceId = `trace-${startAt}`;
  const spanId = `span-${startAt}`;
  const stackTrail = new StackTrail([traceId, spanId]);

  const document = await toDocumentInput(resolved);

  // Always emit attribution. The post-pass runs without a parser
  // (native parsers don't bundle cleanly via `deno bundle`), so AST
  // paths are empty but byte ranges, generators, schema pointers and
  // variants are still captured — enough for the hub's gen-map. The
  // host can re-anchor with a parser later if full AST data is needed.
  const { artifacts, manifest, sidecars, generationMap } = toArtifacts({
    traceId,
    spanId,
    startAt,
    document,
    settings: clientSettings,
    toGeneratorConfigMap,
    stackTrail,
    logsPath,
    silent: true,
    attribution: {
      postPass: {
        schemaSrc: schemaSrc ?? resolved.source?.resolvedUrl ??
          resolved.protocol,
      },
    },
  });

  return { artifacts, manifest, sidecars, generationMap };
};

type CreateServerArgs = {
  toGeneratorConfigMap: <EnrichmentType = undefined>() =>
    GeneratorsMapContainer<EnrichmentType>;
  logsPath?: string;
  /** Deploy-time identity shown on the home page (`/`, `/index.md`,
   *  `/llms.txt`). Optional — without it the page falls back to a generic
   *  self-description. */
  identity?: StackIdentity;
};

export const createServer = (
  { toGeneratorConfigMap, logsPath, identity }: CreateServerArgs,
): Hono => {
  const app = new Hono();

  const toHomeContext = (requestUrl: string): HomePageContext => ({
    identity: identity ?? {},
    generators: Object.keys(toGeneratorConfigMap()),
    origin: new URL(requestUrl).origin,
  });

  app.use(
    "*",
    cors({
      origin: "*",
      allowHeaders: ["api-version", "authorization", "content-type"],
      allowMethods: ["*"],
      credentials: true,
      exposeHeaders: ["api-version", "authorization", "content-type"],
    }),
  );

  // Structured errors, matching the published contract: a body that fails
  // validation is a 400 with field-level issues; an unfetchable source or an
  // unreadable document is a 422 with a reason; anything else is a JSON 500
  // carrying a fixed message. Never the bare-text default — a 4xx always
  // tells the caller what to fix.
  app.onError((error, c) => {
    if (error instanceof v.ValiError) {
      return c.json({
        error: "invalid_request",
        message: "Request body failed validation.",
        issues: error.issues.map((issue) => ({
          path: v.getDotPath(issue),
          message: issue.message,
        })),
      }, 400);
    }
    if (error instanceof InvalidBodyError) {
      return c.json({ error: "invalid_request", message: error.message }, 400);
    }
    if (error instanceof SourceFetchError) {
      return c.json(
        { error: "source_fetch_failed", message: error.message },
        422,
      );
    }
    if (error instanceof SchemaReadError) {
      return c.json({ error: "invalid_schema", message: error.message }, 422);
    }
    // The 4xx messages above are authored for the caller. An uncaught throw
    // is not: its message can carry host paths, internal hostnames and
    // whatever else a generator, core or the runtime put in it, and this
    // route surface is unauthenticated. The log gets the whole error, the
    // caller gets the shape.
    console.error(error);
    return c.json({
      error: "internal_error",
      message: "The server failed to complete the request.",
    }, 500);
  });

  // The home page: HTML for browsers, the flat markdown contract for
  // everything else (curl sends `Accept: */*` — no flags needed).
  app.get("/", (c) => {
    const wantsHtml = (c.req.header("accept") ?? "").includes("text/html");
    return wantsHtml
      ? c.html(homePageHtml(toHomeContext(c.req.url)))
      : c.text(homePageMd(toHomeContext(c.req.url)), 200, {
        "content-type": "text/markdown; charset=utf-8",
      });
  });

  app.get(
    "/index.md",
    (c) =>
      c.text(homePageMd(toHomeContext(c.req.url)), 200, {
        "content-type": "text/markdown; charset=utf-8",
      }),
  );

  app.get("/llms.txt", (c) => c.text(homePageMd(toHomeContext(c.req.url))));

  app.post("/artifacts", async (c) => {
    const body = v.parse(postArtifactsBody, await readJsonBody(c));
    const resolved = await resolveSchemaInput(body);

    const { artifacts, manifest, sidecars, generationMap } =
      await dispatchArtifacts({
        resolved,
        schemaSrc: body.schemaSrc,
        clientSettings: body.clientSettings,
        toGeneratorConfigMap,
        logsPath,
      });

    return c.json({
      artifacts,
      manifest,
      sidecars,
      generationMap,
      ...(resolved.source !== undefined ? { source: resolved.source } : {}),
    }, 200);
  });

  // Capability introspection: which subjects (operations / models) does each
  // configured generator support for this schema? Runs Parse + each generator's
  // `isSupported` only — no transform, no render. Same request body as
  // `/artifacts` (the OAS branch is normalized v2/3.1 → 3.0 first).
  app.post("/subjects", async (c) => {
    const body = v.parse(postArtifactsBody, await readJsonBody(c));
    const resolved = await resolveSchemaInput(body);

    const startAt = Date.now();
    const traceId = `trace-${startAt}`;
    const spanId = `span-${startAt}`;
    const stackTrail = new StackTrail([traceId, spanId]);

    const document = await toDocumentInput(resolved);

    const { subjects, parseIssues } = toSupportedSubjects({
      traceId,
      spanId,
      document,
      settings: body.clientSettings,
      toGeneratorConfigMap,
      stackTrail,
      silent: true,
    });

    return c.json({ subjects, parseIssues }, 200);
  });

  // Seed-values introspection: the DEFAULT enrichment values each configured
  // generator derives from this schema — the "Generate fields from schema"
  // payload the CMS persists, then the user edits. Runs Parse + each generator's
  // `toEnrichmentDefaults` over its supported subjects — no transform, no render.
  // Same request body as `/subjects` (the OAS branch is normalized v2/3.1 → 3.0
  // first). The result mirrors the `client.json#settings.enrichments` subtree
  // (subject scope only), keyed `[id][path][method]['main']` for operations and
  // `[id][refName]['main']` for models.
  app.post("/enrichment-defaults", async (c) => {
    const body = v.parse(postArtifactsBody, await readJsonBody(c));
    const resolved = await resolveSchemaInput(body);

    const startAt = Date.now();
    const traceId = `trace-${startAt}`;
    const spanId = `span-${startAt}`;
    const stackTrail = new StackTrail([traceId, spanId]);

    const document = await toDocumentInput(resolved);

    const { enrichmentDefaults, parseIssues } = toEnrichmentDefaults({
      traceId,
      spanId,
      document,
      settings: body.clientSettings,
      toGeneratorConfigMap,
      stackTrail,
      silent: true,
    });

    return c.json({ enrichmentDefaults, parseIssues }, 200);
  });

  app.get("/generators", (c) => {
    return c.json({ generators: Object.keys(toGeneratorConfigMap()) });
  });

  // Enrichment-schema introspection: the form-renderable descriptor for each
  // generator's enrichment schema. A pure function of the bundled generators —
  // no schema, no parse, no render — so descriptors are stable per bundle and
  // safe to cache by the host keyed on the (immutable) deployment. POST (no
  // body) to match the runner's single `postToBundle` helper.
  app.post("/descriptors", (c) => {
    const descriptors = Object.values(toGeneratorConfigMap()).map(
      toEnrichmentDescriptor,
    );
    return c.json({ descriptors });
  });

  // Enrichment validation: the authoritative verdict on whether the supplied
  // `clientSettings.enrichments` values satisfy each generator's Valibot
  // enrichment schema. Documentless — no schema, no parse, no render — so it
  // mirrors `/descriptors` (a pure function of the bundled generators + the
  // posted enrichments). The host calls this to gate persists, CLI pushes,
  // schema-drift migration, and Publish.
  app.post("/validate", async (c) => {
    const { clientSettings } = v.parse(validateBody, await readJsonBody(c));

    const issues = validateConfig(
      clientSettings?.enrichments,
      Object.values(toGeneratorConfigMap()),
    );

    return c.json({ issues });
  });

  app.post("/to-v3-json", async (c) => {
    const body = v.parse(toV3JsonBody, await readJsonBody(c));
    const schema = body.source !== undefined
      ? (await fetchSource(body.source)).schema
      : body.schema;
    if (schema === undefined) {
      // Unreachable behind the request schema's exactly-one check.
      throw new SchemaReadError("No schema input provided.");
    }

    // 3.0/3.1 pass through unchanged; only Swagger 2.0 is converted to 3.0.
    try {
      const normalizedDocument = await toV3Document(stringToSchema(schema));
      return c.json({ schema: normalizedDocument });
    } catch (error) {
      if (error instanceof SchemaReadError) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      throw new SchemaReadError(`Could not read OAS document: ${reason}`);
    }
  });

  // Self-description: the server's own published OpenAPI 3.1 contract, covering
  // every route above. Generated from the request valibot schemas + `@skmtc/core`
  // response schemas at build time (`deno task openapi`) and served as the
  // committed static artifact — the converter is kept out of the deployed bundle.
  // A GET with no body, like `/generators`, so a deployed server self-documents.
  app.get("/openapi.json", (c) => c.json(openApiDocument));

  return app;
};
