import { type GeneratorsMapContainer, toArtifacts } from '@skmtc/core'
import {
  StackTrail,
  toEnrichmentDefaults,
  toEnrichmentDescriptor,
  toSupportedSubjects
} from '@skmtc/core'
import type { AttributionState } from '@skmtc/core/AttributionState'
import type { SerializableAttribution, WorkerMessage } from './types.ts'

// Re-export for hosts that want both the runtime entry and the
// payload types from the same module path.
export type {
  DescribePayload,
  GeneratePayload,
  WorkerMessage,
  WorkerResult,
  WorkerDescribeResult,
  SerializableAttribution
} from './types.ts'

/**
 * Reconstruct the full `AttributionState` from the serialisable
 * subset that crossed the worker boundary. Returns `undefined` when
 * the payload didn't include an attribution config — the worker
 * passes that straight through to `toArtifacts`.
 *
 * The non-serialisable bits get reconstituted here:
 *  - `parser` is intentionally **omitted** worker-side. Both
 *    candidate parsers (oxc-parser's napi bindings, tsc's
 *    source-map-support chain) don't bundle cleanly into a Web
 *    Worker via `deno bundle`. Without a parser the sidecar still
 *    captures byte ranges, attributions, generators, schema
 *    pointers, and variants — landmark names come from the
 *    enclosing Definition's identifier (no AST descent), and
 *    `path` stays empty. A host-side post-pass that runs oxc on
 *    the rendered source can fill those in later if needed.
 *  - `generatorMeta` becomes a lookup function over the plain
 *    `Record<genId, {version, registry}>` map, with a graceful
 *    fallback for unknown ids.
 */
const buildAttributionState = (
  serialised: SerializableAttribution | undefined
): AttributionState | undefined => {
  // Capture is always on in core; `AttributionState` now carries only
  // emission config. No postPass → nothing to emit → return undefined
  // (core still captures). With postPass → reconstitute the lookup fn.
  if (!serialised?.postPass) return undefined

  const { schemaSrc, generatorMeta } = serialised.postPass
  return {
    postPass: {
      schemaSrc,
      generatorMeta: generatorMeta
        ? (genId: string) =>
            generatorMeta[genId] ?? {
              version: '',
              registry: { host: 'jsr.io', type: 'jsr' as const }
            }
        : undefined
    }
  }
}

/**
 * Worker entry that runs the SKMTC code-generation pipeline in a
 * background thread.
 *
 * The worker accepts a single `GENERATE` message whose payload carries
 * a {@link SkmtcDocumentInput} `document` field. `toArtifacts` runs the
 * protocol-specific parse step inside the pipeline based on
 * `document.type` — the worker itself doesn't branch on protocol.
 *
 * `parseIssues` are nested inside the manifest now; the worker forwards
 * the manifest as-is and no separate field travels on the wire.
 *
 * When `payload.attribution.postPass` is set, the worker also
 * reconstitutes the full `AttributionState` (with `oxcAdapter` + a
 * lookup fn rebuilt from the plain `generatorMeta` map) and forwards
 * the resulting `sidecars` + `generationMap` in the RESULT message.
 */
const toWorker = (
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
) => {
  // Debug: when `SKMTC_DEBUG_INSPECTOR` is set, self-register the worker isolate
  // with the V8 inspector and relay its debugger URL. Deno does not auto-expose
  // worker isolates as debug targets, but a worker that calls `inspector.open()`
  // becomes an attachable CDP target — so a debugger can breakpoint generator
  // code running in the sandboxed Worker (see the CLI debugger plan). Gated by the
  // env var + a dynamic import so production / hosted runs are untouched.
  const debugInspector = (() => {
    try {
      return Boolean(Deno.env.get('SKMTC_DEBUG_INSPECTOR'))
    } catch {
      return false
    }
  })()
  if (debugInspector) {
    import('node:inspector')
      .then(inspector => {
        inspector.open(0, '127.0.0.1', false)
        self.postMessage({ type: 'INSPECTOR', url: inspector.url() })
      })
      .catch((error: unknown) => {
        self.postMessage({ type: 'ERROR', error: `inspector.open failed: ${String(error)}` })
      })
  }

  self.onmessage = async (e: MessageEvent) => {
    // Boundary cast of the structured-clone payload, as elsewhere in
    // this handler. `message` is the discriminated union; `rawType` is
    // captured separately so the malformed-message `default` can report
    // the offending value without narrowing `message` to `never`.
    const rawType = (e.data as { type?: unknown }).type
    const message = e.data as WorkerMessage

    try {
      switch (message.type) {
        case 'GENERATE': {
          const { payload } = message
          const startAt = Date.now()
          const traceId = `trace-${startAt}`
          const spanId = `span-${startAt}`
          const stackTrail = new StackTrail([traceId, spanId])

          // Resolve the attribution config. The worker doesn't load
          // a parser (see `buildAttributionState` doc); landmark
          // names come from Definition identifiers instead of AST
          // descent.
          const attribution = buildAttributionState(payload.attribution)

          const { artifacts, manifest, sidecars, generationMap, inspection } = toArtifacts({
            traceId,
            spanId,
            startAt,
            document: payload.document,
            settings: payload.clientSettings,
            stackTrail,
            toGeneratorConfigMap,
            logsPath: undefined,
            silent: payload.silent ?? false,
            attribution,
            inspect: payload.inspect
          })

          self.postMessage({
            type: 'RESULT',
            artifacts,
            manifest,
            sidecars,
            generationMap,
            inspection
          })
          break
        }
        case 'DESCRIBE': {
          const { payload } = message
          const startAt = Date.now()
          const traceId = `trace-${startAt}`
          const spanId = `span-${startAt}`

          // The three read-only engine calls the bundle's `server.js`
          // exposes at /subjects, /descriptors, /enrichment-defaults.
          // Calling them here (rather than via a server bundle) keeps
          // local `skmtc describe` shape-identical to the hub runner.
          // Each pass gets its own StackTrail (the parse phase mutates
          // it). Descriptors are documentless — a pure map over the
          // bundled generators.
          const { subjects, parseIssues: subjectIssues } = toSupportedSubjects({
            traceId,
            spanId,
            document: payload.document,
            settings: payload.clientSettings,
            toGeneratorConfigMap,
            stackTrail: new StackTrail([traceId, spanId]),
            silent: true
          })

          const { enrichmentDefaults, parseIssues: defaultIssues } = toEnrichmentDefaults({
            traceId,
            spanId,
            document: payload.document,
            settings: payload.clientSettings,
            toGeneratorConfigMap,
            stackTrail: new StackTrail([traceId, spanId]),
            silent: true
          })

          const descriptors = Object.values(toGeneratorConfigMap()).map(toEnrichmentDescriptor)

          self.postMessage({
            type: 'RESULT',
            subjects,
            descriptors,
            enrichmentDefaults,
            parseIssues: [...subjectIssues, ...defaultIssues]
          })
          break
        }
        default: {
          self.postMessage({
            type: 'ERROR',
            error: `Unknown message type: ${String(rawType)}`
          })
          break
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        self.postMessage({
          type: 'ERROR',
          error: error.message || String(error),
          stack: error.stack
        })
      } else {
        self.postMessage({
          type: 'ERROR',
          error: String(error)
        })
      }
    }
  }

  // Signal ready
  self.postMessage({ type: 'READY', generatorIds: Object.keys(toGeneratorConfigMap()) })
}

// Expose buildAttributionState for unit-testing without spawning a worker.
export { buildAttributionState }

export default toWorker
