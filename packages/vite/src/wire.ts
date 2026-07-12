// The plugin's desktop-facing wire contract, as valibot schemas — the SINGLE
// source of truth for both ends. The plugin's own types are inferred from
// these (v.InferOutput), and the desktop imports the same schemas via the
// `@skmtc/vite/wire` subpath instead of hand-mirroring them, so the two sides
// cannot drift.
//
// BROWSER-SAFE by construction: this module may import only valibot — no
// node builtins, no plugin internals — because the desktop bundles it into
// the SPA. Consumer-leniency decisions live HERE, on the producer, where the
// shape is defined:
//   - a misfit's `reason` is decoration → v.fallback to absent on any
//     malformed value (never fail the whole outcome parse);
//   - tuples tolerate extra items (valibot semantics, kept deliberately) —
//     a future plugin appending metadata must not break older desktops.

import * as v from 'valibot'

// --- input matcher -------------------------------------------------------------

/** A module export offered by the picker — the SAME `{ exportName,
 *  exportPath }` shape the `moduleExport` enrichment stores. */
export const candidateSchema = v.object({
  exportName: v.string(),
  exportPath: v.string()
})
export type MatcherCandidate = v.InferOutput<typeof candidateSchema>

/**
 * A misfit's WHY, as structured data (never a pre-rendered blob): the TS
 * diagnostic's top message plus its nested elaboration chain, outermost
 * first, sanitized of probe-internal names. The UI decides layout
 * (headline, expected/received split, "why" list).
 */
export const misfitReasonSchema = v.object({
  /** The TS diagnostic code of the failed assignment (e.g. 2322). */
  code: v.number(),
  /** The top-level message — `Type 'X' is not assignable to type 'Y'.` */
  headline: v.string(),
  /** The nested elaborations, depth-first: each step of the compiler's
   *  reasoning down to the leaf cause. */
  reasons: v.array(v.string())
})
export type MisfitReason = v.InferOutput<typeof misfitReasonSchema>

/** A rejected candidate, optionally carrying the compiler's structured WHY —
 *  present when the explain pass elaborated the failed assignment. The reason
 *  is decoration: a malformed one falls back to absent so it can never fail
 *  the outcome parse. */
export const misfitCandidateSchema = v.object({
  exportName: v.string(),
  exportPath: v.string(),
  reason: v.fallback(v.optional(misfitReasonSchema), undefined)
})
export type MisfitCandidate = v.InferOutput<typeof misfitCandidateSchema>

/**
 * Every match resolves to a NAMED outcome — there is no fallback candidate
 * list. `fits` is the only selectable set; `path-broken` pinpoints the exact
 * stale segment (distinct from "resolved and nothing fits", which is `fits`
 * with an empty `fits` array); `model-missing` / `unavailable` are explicit
 * failures the UI surfaces as errors.
 */
export const matchOutcomeSchema = v.variant('type', [
  v.object({
    type: v.literal('fits'),
    /** The resolved field type, printed by the project's compiler. */
    fieldType: v.string(),
    fits: v.array(candidateSchema),
    misfits: v.array(misfitCandidateSchema),
    unresolved: v.array(candidateSchema)
  }),
  v.object({
    type: v.literal('path-broken'),
    modelName: v.string(),
    brokenAt: v.object({ index: v.number(), segment: v.string() })
  }),
  v.object({
    type: v.literal('model-missing'),
    modelName: v.nullable(v.string()),
    detail: v.string()
  }),
  v.object({ type: v.literal('unavailable'), reason: v.string() })
])
export type MatchOutcome = v.InferOutput<typeof matchOutcomeSchema>

// --- gen-map (GET /__skmtc/gen-map) ----------------------------------------------

/** One attributed span — the hub's contract `GenMapEntry`, plus `variant`. */
export const genMapEntrySchema = v.object({
  /** Manifest-keyed artifact path (`src/...`), realigned from the sidecar's
   *  `@/`-aliased form. */
  artifactPath: v.string(),
  /** `[from, to)` span in UTF-16 code units — CodeMirror positions. */
  artifactSpan: v.tuple([v.number(), v.number()]),
  /** Enclosing Projection/Definition name (the `L` pool). */
  projectionName: v.string(),
  /** Exact emitting Projection/Snippet class (the `N` pool). */
  producerName: v.string(),
  /** Generator package name (the `G` pool) — `''`/`<unknown>` when the
   *  snippet didn't thread its generator. */
  generatorRef: v.string(),
  /** JSON pointer into the source schema; `''` when not captured. */
  schemaPointer: v.string(),
  /** Enrichment variant the span belongs to (the `V` pool); `'main'` default. */
  variant: v.string()
})
export type GenMapEntry = v.InferOutput<typeof genMapEntrySchema>

export const genMapResultSchema = v.object({
  entries: v.array(genMapEntrySchema),
  /** Manifest files whose on-disk length no longer matches the engine render
   *  (`manifest.characters`) — their spans are stale (e.g. the project ran a
   *  formatter after generate) and must not be decorated. Length equality is
   *  a HEURISTIC, not content-exact: a rewrite that preserves character count
   *  (balanced quote-style flips, tab/space swaps) escapes detection. It is
   *  the best signal the manifest offers (`lines`/`characters` only). */
  staleFiles: v.array(v.string())
})
export type GenMapResult = v.InferOutput<typeof genMapResultSchema>

// --- project source + artifacts --------------------------------------------------

/** One project source file (GET /__skmtc/source `files` entries). */
export const sourceFileSchema = v.object({
  /** Root-relative path (`src/...`). */
  path: v.string(),
  content: v.string()
})
export type SourceFile = v.InferOutput<typeof sourceFileSchema>

/** GET /__skmtc/source — the input-dir sources the code pane can seed from.
 *  (`inputDirs` also rides along in the response; consumers that only need
 *  the files may parse with this schema, which ignores unknown keys.) */
export const sourceResponseSchema = v.object({
  files: v.array(sourceFileSchema)
})
export type SourceResponse = v.InferOutput<typeof sourceResponseSchema>

/** GET /__skmtc/artifacts?path=… — one generated file's content. */
export const artifactContentSchema = v.object({ content: v.string() })
export type ArtifactContent = v.InferOutput<typeof artifactContentSchema>
