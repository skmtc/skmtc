import { cors } from 'hono/cors'
import { Hono } from 'hono'
import {
  clientSettings as settingsSchema,
  toArtifacts,
  toEnrichmentDefaults,
  toEnrichmentDescriptor,
  toSupportedSubjects
} from '@skmtc/core'
import type { GeneratorsMapContainer, SkmtcDocumentInput } from '@skmtc/core'
import type { ManifestContent } from '@skmtc/core/Manifest'
import type { Sidecar, GenerationMapEntry } from '@skmtc/core/Anchors'
import { stringToSchema, toV3Document } from '@skmtc/convert'
import * as v from 'valibot'
import { StackTrail } from '@skmtc/core'

/**
 * Body schemas for `POST /artifacts`, modeled as a discriminated
 * union over `protocol`. Each variant declares the field it actually
 * needs — there are no optional / "maybe present" fields whose
 * presence depends on another field's value.
 *
 * The shared half (`schema`, `clientSettings`) is spread into each
 * variant rather than extracted into a base, because the branching
 * shape is the more important property to make obvious.
 */
const oasArtifactsBody = v.object({
  protocol: v.literal('oas'),
  schema: v.string(),
  clientSettings: v.optional(settingsSchema),
  /** Schema source identifier stamped onto each sidecar's `src` field
   *  (e.g. `'openapi.json'`). Optional — defaults to the protocol name. */
  schemaSrc: v.optional(v.string())
})

const gqlArtifactsBody = v.object({
  protocol: v.literal('gql'),
  schema: v.string(),
  clientSettings: v.optional(settingsSchema),
  /** Schema source identifier stamped onto each sidecar's `src` field.
   *  Optional — defaults to the protocol name. */
  schemaSrc: v.optional(v.string())
})

/**
 * Discriminated request body for `POST /artifacts`. `v.variant` keys
 * on `protocol` and routes to the matching variant — clients must
 * send `protocol: 'oas'` or `protocol: 'gql'` explicitly. After
 * parsing, the result is a properly-narrowed discriminated union.
 */
const postArtifactsBody = v.variant('protocol', [oasArtifactsBody, gqlArtifactsBody])

type ArtifactsBody = v.InferOutput<typeof postArtifactsBody>

type GenerateResult = {
  artifacts: Record<string, string>
  manifest: ManifestContent
  /** Per-file attribution sidecars (byte-range → producer). Present
   *  because attribution is always enabled with a post-pass below. */
  sidecars?: Record<string, Sidecar>
  /** Per-Definition generation-map index (file → schema origin). */
  generationMap?: GenerationMapEntry[]
}

type DispatchArgs = {
  body: ArtifactsBody
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
  logsPath: string | undefined
}

/**
 * Routes a parsed request body to the appropriate core entry point.
 *
 * The `body` parameter is already a discriminated union (validated by
 * `postArtifactsBody`), so switch-narrowing on `body.protocol`
 * automatically narrows the rest of the body's shape — there's
 * nothing to assert at runtime.
 */
const dispatchArtifacts = async ({
  body,
  toGeneratorConfigMap,
  logsPath
}: DispatchArgs): Promise<GenerateResult> => {
  const startAt = Date.now()
  const traceId = `trace-${startAt}`
  const spanId = `span-${startAt}`
  const stackTrail = new StackTrail([traceId, spanId])

  // Build the unified SkmtcDocumentInput from the protocol-specific
  // body shape, then route through the single `toArtifacts` entry. The
  // host-side OAS normalization (Swagger 2 / 3.1 → 3.0 via
  // `@skmtc/convert`) still runs here; GQL passes its SDL through
  // unchanged.
  let document: SkmtcDocumentInput
  switch (body.protocol) {
    case 'oas': {
      const documentObject = await toV3Document(stringToSchema(body.schema))
      document = { type: 'oas', value: documentObject }
      break
    }
    case 'gql': {
      document = { type: 'gql', value: body.schema }
      break
    }
    default: {
      const _exhaustive: never = body
      throw new Error(`Unhandled protocol: ${JSON.stringify(_exhaustive)}`)
    }
  }

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
    settings: body.clientSettings,
    toGeneratorConfigMap,
    stackTrail,
    logsPath,
    silent: true,
    attribution: {
      postPass: { schemaSrc: body.schemaSrc ?? body.protocol }
    }
  })

  return { artifacts, manifest, sidecars, generationMap }
}

type CreateServerArgs = {
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
  logsPath?: string
}

export const createServer = ({ toGeneratorConfigMap, logsPath }: CreateServerArgs): Hono => {
  const app = new Hono()

  app.use(
    '*',
    cors({
      origin: '*',
      allowHeaders: ['api-version', 'authorization', 'content-type'],
      allowMethods: ['*'],
      credentials: true,
      exposeHeaders: ['api-version', 'authorization', 'content-type']
    })
  )

  app.post('/artifacts', async c => {
    const body = v.parse(postArtifactsBody, await c.req.json())

    const { artifacts, manifest, sidecars, generationMap } = await dispatchArtifacts({
      body,
      toGeneratorConfigMap,
      logsPath
    })

    return c.json({ artifacts, manifest, sidecars, generationMap }, 200)
  })

  // Capability introspection: which subjects (operations / models) does each
  // configured generator support for this schema? Runs Parse + each generator's
  // `isSupported` only — no transform, no render. Same request body as
  // `/artifacts` (the OAS branch is normalized v2/3.1 → 3.0 first).
  app.post('/subjects', async c => {
    const body = v.parse(postArtifactsBody, await c.req.json())

    const startAt = Date.now()
    const traceId = `trace-${startAt}`
    const spanId = `span-${startAt}`
    const stackTrail = new StackTrail([traceId, spanId])

    let document: SkmtcDocumentInput
    switch (body.protocol) {
      case 'oas': {
        document = { type: 'oas', value: await toV3Document(stringToSchema(body.schema)) }
        break
      }
      case 'gql': {
        document = { type: 'gql', value: body.schema }
        break
      }
      default: {
        const _exhaustive: never = body
        throw new Error(`Unhandled protocol: ${JSON.stringify(_exhaustive)}`)
      }
    }

    const { subjects, parseIssues } = toSupportedSubjects({
      traceId,
      spanId,
      document,
      settings: body.clientSettings,
      toGeneratorConfigMap,
      stackTrail,
      silent: true
    })

    return c.json({ subjects, parseIssues }, 200)
  })

  // Seed-values introspection: the DEFAULT enrichment values each configured
  // generator derives from this schema — the "Generate fields from schema"
  // payload the CMS persists, then the user edits. Runs Parse + each generator's
  // `toEnrichmentDefaults` over its supported subjects — no transform, no render.
  // Same request body as `/subjects` (the OAS branch is normalized v2/3.1 → 3.0
  // first). The result mirrors the `client.json#settings.enrichments` subtree
  // (subject scope only), keyed `[id][path][method]['main']` for operations and
  // `[id][refName]['main']` for models.
  app.post('/enrichment-defaults', async c => {
    const body = v.parse(postArtifactsBody, await c.req.json())

    const startAt = Date.now()
    const traceId = `trace-${startAt}`
    const spanId = `span-${startAt}`
    const stackTrail = new StackTrail([traceId, spanId])

    let document: SkmtcDocumentInput
    switch (body.protocol) {
      case 'oas': {
        document = { type: 'oas', value: await toV3Document(stringToSchema(body.schema)) }
        break
      }
      case 'gql': {
        document = { type: 'gql', value: body.schema }
        break
      }
      default: {
        const _exhaustive: never = body
        throw new Error(`Unhandled protocol: ${JSON.stringify(_exhaustive)}`)
      }
    }

    const { enrichmentDefaults, parseIssues } = toEnrichmentDefaults({
      traceId,
      spanId,
      document,
      settings: body.clientSettings,
      toGeneratorConfigMap,
      stackTrail,
      silent: true
    })

    return c.json({ enrichmentDefaults, parseIssues }, 200)
  })

  app.get('/generators', c => {
    return c.json({ generators: Object.keys(toGeneratorConfigMap()) })
  })

  // Enrichment-schema introspection: the form-renderable descriptor for each
  // generator's enrichment schema. A pure function of the bundled generators —
  // no schema, no parse, no render — so descriptors are stable per bundle and
  // safe to cache by the host keyed on the (immutable) deployment. POST (no
  // body) to match the runner's single `postToBundle` helper.
  app.post('/descriptors', c => {
    const descriptors = Object.values(toGeneratorConfigMap()).map(toEnrichmentDescriptor)
    return c.json({ descriptors })
  })

  app.post('/to-v3-json', async c => {
    const body = await c.req.json()

    const { schema } = v.parse(v.object({ schema: v.string() }), body)

    const oas30Document = await toV3Document(stringToSchema(schema))

    return c.json({ schema: oas30Document })
  })

  return app
}
