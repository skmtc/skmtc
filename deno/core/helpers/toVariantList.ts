import { DEFAULT_VARIANT } from '@/types/Variant.ts'

type ToVariantListArgs = {
  /**
   * The enrichment block at `[generatorId][path][method]` (OAS) or
   * `[generatorId][rootKind][fieldName]` (GQL). Typed as `unknown`
   * because `lodash-es/get()` returns `unknown` and the engine
   * doesn't pre-validate this branch.
   */
  opEnrichments: unknown
  generatorId: string
  /**
   * Human-readable identifier for the operation used in the
   * missing-`main` error message — e.g. `'PATCH /v2/quotes/{id}'` for
   * OAS or `'mutation createUser'` for GraphQL.
   */
  operationLabel: string
}

/**
 * Enumerate the operation variants the engine should fan out over.
 *
 * - No enrichment block → `['main']` (consumer skipped this generator
 *   entirely, or wrote no per-operation overrides).
 * - Non-object enrichment block → `['main']` (defensive — Valibot at
 *   parse time will catch this once the per-variant wrap lands).
 * - Empty-object enrichment block → `['main']` (no consumer-named
 *   variants, fall back to default).
 * - Object enrichment block with keys → its keys, in JSON-insertion
 *   order. `'main'` must be among them or we throw — silent
 *   zero-output downstream is the worse failure mode.
 */
export const toVariantList = ({
  opEnrichments,
  generatorId,
  operationLabel
}: ToVariantListArgs): string[] => {
  if (opEnrichments === null || opEnrichments === undefined) {
    return [DEFAULT_VARIANT]
  }

  if (typeof opEnrichments !== 'object' || Array.isArray(opEnrichments)) {
    return [DEFAULT_VARIANT]
  }

  const keys = Object.keys(opEnrichments)

  if (keys.length === 0) {
    return [DEFAULT_VARIANT]
  }

  if (!keys.includes(DEFAULT_VARIANT)) {
    throw new Error(
      `[${generatorId}] Enrichments for '${operationLabel}' must include a ` +
        `'${DEFAULT_VARIANT}' variant. Found variants: ${keys.join(', ')}.`
    )
  }

  return keys
}
