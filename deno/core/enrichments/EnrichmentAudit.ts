/**
 * @fileoverview The enrichment consumption audit.
 *
 * The engine already performs every enrichment lookup during the generate
 * walk — the dispatch loops read each `[generatorId][...subject]` block to
 * enumerate variants, the projection statics read each subject leaf and
 * the run-constant scopes, and the Drivers read peer blocks for the
 * variant guard. `EnrichmentAudit` records those lookups (every read is
 * routed through `GenerateContext.readEnrichment`, the single choke
 * point) and, post-walk, diffs them against the paths actually present in
 * `settings.enrichments`. A configured path no lookup touched is dead
 * config — a typo'd generator id / path / method / model name, or an
 * entry orphaned by spec evolution — and becomes an
 * `UNCONSUMED_ENRICHMENT` warning on the manifest.
 *
 * Consumption is recorded prefix-closed: consuming
 * `[id, '/pets', 'post', 'main']` also marks `[id, '/pets', 'post']`,
 * `[id, '/pets']`, and `[id]`. The present-path enumeration walks each
 * generator's slice to the block depth its entry type dictates (model:
 * `[refName]`; operation / webhook / GQL: two segments), so the diff
 * compares like with like. Reserved keys (`_generator`, `_stack`) are
 * engine-owned constants and never flagged.
 *
 * Everything here is warn-level and fail-open — the audit can only add
 * warnings to the manifest, never change generation output.
 *
 * @module EnrichmentAudit
 */

import {
  STACK_ENRICHMENT_KEY,
  isReservedEnrichmentKey,
  type GeneratorEnrichments
} from '@/types/Enrichments.ts'
import { formatEnrichmentPath, type EnrichmentWarning } from '@/enrichments/EnrichmentWarning.ts'
import { nearestKey } from '@/helpers/nearestKey.ts'

/**
 * The slice of a generator entry the audit needs: its id and the entry
 * type that dictates its enrichment routing depth.
 */
export type AuditGenerator = {
  readonly id: string
  readonly type: 'oasOperation' | 'gqlOperation' | 'model' | 'webhook'
}

type FinalizeArgs = {
  /** The consumer's `client.json#settings.enrichments` record. */
  enrichments: GeneratorEnrichments | undefined
  /** The generators configured for this run. */
  generators: readonly AuditGenerator[]
  /**
   * Generator ids the consumer skipped wholesale (string entries in
   * `settings.skip`). Their slices are reported as info, not warnings —
   * a temporary skip is legitimate, not dead config.
   */
  skippedGeneratorIds: readonly string[]
}

const toPathKey = (segments: readonly string[]): string => JSON.stringify(segments)

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null && !Array.isArray(input)

export class EnrichmentAudit {
  /** Prefix-closed set of consumed routing paths, keyed by {@link toPathKey}. */
  #consumed = new Set<string>()
  /** Consumed child segments per parent path — the suggestion candidates. */
  #children = new Map<string, Set<string>>()
  #warnings: EnrichmentWarning[] = []
  /** Identity keys of reported warnings — reads repeat, warnings must not. */
  #reported = new Set<string>()

  /**
   * Record one enrichment lookup. Every prefix of `segments` is marked
   * consumed, so block-level and leaf-level reads land in one namespace.
   */
  consume(segments: readonly string[]): void {
    let parentKey = toPathKey([])

    for (let end = 1; end <= segments.length; end++) {
      const key = toPathKey(segments.slice(0, end))
      this.#consumed.add(key)

      const siblings = this.#children.get(parentKey)
      if (siblings) {
        siblings.add(segments[end - 1])
      } else {
        this.#children.set(parentKey, new Set([segments[end - 1]]))
      }

      parentKey = key
    }
  }

  /**
   * Add a warning, deduplicated on `(type, path)` — the same lookup can
   * repeat many times per run (one per insert call) and must produce one
   * warning.
   */
  report(warning: EnrichmentWarning): void {
    const key = toPathKey([warning.type, ...warning.path])
    if (this.#reported.has(key)) return

    this.#reported.add(key)
    this.#warnings.push(warning)
  }

  #isConsumed(segments: readonly string[]): boolean {
    return this.#consumed.has(toPathKey(segments))
  }

  /**
   * Nearest consumed sibling of the FIRST segment where `path` diverges
   * from the consumed set — a typo'd path diverges at the path segment,
   * a typo'd method at the method segment, and the suggestion must name
   * the segment that actually went wrong.
   */
  #divergenceSuggestion(path: readonly string[]): string | undefined {
    for (let depth = 0; depth < path.length; depth++) {
      if (this.#isConsumed(path.slice(0, depth + 1))) continue

      const siblings = this.#children.get(toPathKey(path.slice(0, depth)))
      return siblings ? nearestKey(path[depth], siblings) : undefined
    }
    return undefined
  }

  #checkBlock(path: readonly string[]): void {
    if (this.#isConsumed(path)) return

    const suggestion = this.#divergenceSuggestion(path)

    this.report({
      level: 'warning',
      type: 'UNCONSUMED_ENRICHMENT',
      path,
      message:
        `enrichment entry '${formatEnrichmentPath(path)}' was never consumed — ` +
        `no matching generator or subject in this run` +
        (suggestion !== undefined ? ` (did you mean '${suggestion}'?)` : ''),
      ...(suggestion !== undefined ? { suggestion } : {})
    })
  }

  /**
   * Diff the configured enrichment paths against the consumed set and
   * return every warning gathered during the run plus the addressing
   * misses found here. Called once, after the generate walk.
   */
  finalize({ enrichments, generators, skippedGeneratorIds }: FinalizeArgs): EnrichmentWarning[] {
    if (!isRecord(enrichments)) return [...this.#warnings]

    const generatorsById = new Map(generators.map(generator => [generator.id, generator]))
    const skipped = new Set(skippedGeneratorIds)

    for (const [generatorId, slot] of Object.entries(enrichments)) {
      if (generatorId === STACK_ENRICHMENT_KEY) continue
      // Other `_`-prefixed keys are structurally invalid — the
      // `generatorEnrichments` schema flags those at config load.
      if (isReservedEnrichmentKey(generatorId)) continue

      if (skipped.has(generatorId)) {
        this.report({
          level: 'info',
          type: 'SKIPPED_GENERATOR_ENRICHMENT',
          path: [generatorId],
          message:
            `generator '${generatorId}' is skipped in this run — ` +
            `its enrichments were not applied`
        })
        continue
      }

      const generator = generatorsById.get(generatorId)

      if (!generator) {
        // An insert-only peer (reached via insertOperation / insertModel
        // without an entry of its own) still consumes its slice through
        // the projection statics — a consumed prefix means the slice is
        // live, and without an entry type its depth is unknowable, so the
        // audit leaves it alone.
        if (this.#isConsumed([generatorId])) continue

        const suggestion = nearestKey(generatorId, generatorsById.keys())
        this.report({
          level: 'warning',
          type: 'UNKNOWN_GENERATOR_ID',
          path: [generatorId],
          message:
            `enrichments are configured for '${generatorId}' but no generator ` +
            `with that id is in this run` +
            (suggestion !== undefined ? ` (did you mean '${suggestion}'?)` : ''),
          ...(suggestion !== undefined ? { suggestion } : {})
        })
        continue
      }

      if (!isRecord(slot)) continue

      // The generator is in the run but consumed nothing at all — the
      // document has no subjects of its type (or the wrong protocol).
      // Per-entry warnings would fall back to cross-generator siblings for
      // their "did you mean …?" and could name an unrelated generator, so
      // collapse to one generator-level warning that says what happened.
      const hasSubjectEntries = Object.keys(slot).some(key => !isReservedEnrichmentKey(key))

      if (!this.#isConsumed([generatorId]) && hasSubjectEntries) {
        this.report({
          level: 'warning',
          type: 'UNCONSUMED_ENRICHMENT',
          path: [generatorId],
          message:
            `enrichments are configured for '${generatorId}' but it matched ` +
            `no subjects in this run — its enrichments were never read`
        })
        continue
      }

      // Block depth per entry type: `[refName]` for models,
      // `[path][method]` / `[name][method]` / `[rootKind][fieldName]`
      // for the operation-shaped types.
      const subjectDepth = generator.type === 'model' ? 1 : 2

      for (const [subjectKey, subjectValue] of Object.entries(slot)) {
        // `_generator` (and any other reserved key) is engine-owned — read
        // through the dedicated helpers by known key, always consumed.
        if (isReservedEnrichmentKey(subjectKey)) continue

        if (
          subjectDepth === 1 ||
          !isRecord(subjectValue) ||
          Object.keys(subjectValue).length === 0
        ) {
          this.#checkBlock([generatorId, subjectKey])
          continue
        }

        for (const methodKey of Object.keys(subjectValue)) {
          this.#checkBlock([generatorId, subjectKey, methodKey])
        }
      }
    }

    return [...this.#warnings]
  }
}

/**
 * Whether an enrichment block declares the given variant — the presence
 * probe behind `SKIPPED_SUBJECT_ENRICHMENT` info lines. Exported for the
 * dispatch loops; a non-record block (absent or malformed) has no
 * variants.
 */
export const hasVariantEnrichment = (block: unknown, variant: string): boolean =>
  isRecord(block) && variant in block
