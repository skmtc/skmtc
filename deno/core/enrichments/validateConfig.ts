import * as v from 'valibot'
import {
  GENERATOR_ENRICHMENT_KEY,
  STACK_ENRICHMENT_KEY,
  isReservedEnrichmentKey,
  type GeneratorEnrichments
} from '@/types/Enrichments.ts'
import type { EnrichmentSource } from '@/enrichments/toEnrichmentDescriptor.ts'

/**
 * Which of the three enrichment scopes a validation issue belongs to.
 * Mirrors the `{ subject, generator, stack }` umbrella members.
 */
export type EnrichmentValidationScope = 'subject' | 'generator' | 'stack'

/**
 * One enrichment value that fails its generator's Valibot enrichment
 * schema — the authoritative validation verdict. Produced by
 * {@link validateConfig}; the routing fields locate the offending leaf in
 * `client.json#settings.enrichments`:
 *
 *  - **operation subject** — `subject` = path, `method` = HTTP method
 *  - **model subject** — `subject` = refName (no `method`)
 *  - **gql operation subject** — `subject` = field name, `method` = root kind
 *  - **generator** run-constant — `scope: 'generator'` (no subject routing)
 *  - **stack** run-constant — `scope: 'stack'` (no subject routing)
 *
 * `field` is the dotted path to the offending key *within* the leaf
 * (absent when the whole leaf is the wrong shape).
 */
export type EnrichmentValidationIssue = {
  generator: string
  scope: EnrichmentValidationScope
  subject?: string
  method?: string
  variant?: string
  field?: string
  message: string
}

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null && !Array.isArray(input)

const firstKey = (path: ReadonlyArray<{ readonly key?: unknown }> | undefined): string | undefined =>
  path && path.length > 0 && path[0].key !== undefined ? String(path[0].key) : undefined

const fieldPath = (
  path: ReadonlyArray<{ readonly key?: unknown }> | undefined
): string | undefined =>
  path && path.length > 1
    ? path
        .slice(1)
        .map(segment => String(segment.key))
        .join('.')
    : undefined

/** Routing identity for one subject leaf, derived from the generator kind. */
type SubjectLeaf = {
  subject: string
  method?: string
  variant: string
  values: unknown
}

/**
 * Collect every `{ subject, method?, variant, values }` leaf from a
 * generator's enrichment slot, walking the routing depth its **kind**
 * dictates — model (`refName → variant`), oas operation
 * (`path → method → variant`), gql operation
 * (`rootKind → fieldName → variant`). Because the kind is read from the
 * generator entry, operation-vs-model is known authoritatively — there is
 * no `'main' in value` shape-guessing. Reserved keys (`_generator`) are
 * skipped; malformed nodes are skipped (they surface elsewhere, never here
 * as a value error).
 */
const collectSubjectLeaves = (type: EnrichmentSource['type'], slot: Record<string, unknown>): SubjectLeaf[] => {
  const leaves: SubjectLeaf[] = []

  for (const [subjectKey, subjectValue] of Object.entries(slot)) {
    if (isReservedEnrichmentKey(subjectKey)) continue
    if (!isRecord(subjectValue)) continue

    switch (type) {
      case 'model': {
        // refName → { variant: values }
        for (const [variant, values] of Object.entries(subjectValue)) {
          leaves.push({ subject: subjectKey, variant, values })
        }
        break
      }
      case 'oasOperation': {
        // path → { method: { variant: values } }
        for (const [method, variants] of Object.entries(subjectValue)) {
          if (!isRecord(variants)) continue
          for (const [variant, values] of Object.entries(variants)) {
            leaves.push({ subject: subjectKey, method, variant, values })
          }
        }
        break
      }
      case 'gqlOperation': {
        // rootKind → { fieldName: { variant: values } }
        for (const [fieldName, variants] of Object.entries(subjectValue)) {
          if (!isRecord(variants)) continue
          for (const [variant, values] of Object.entries(variants)) {
            leaves.push({ subject: fieldName, method: subjectKey, variant, values })
          }
        }
        break
      }
      default: {
        const _exhaustive: never = type
        throw new Error(`Unhandled generator type: ${String(_exhaustive)}`)
      }
    }
  }

  return leaves
}

/**
 * Validate one scope's value against the generator's composite umbrella
 * schema, reporting only issues that belong to that scope. The other two
 * scopes are passed `undefined` and any issues they raise are filtered out,
 * so each scope is validated in isolation without duplicating run-constant
 * errors across every subject. Mirrors generate-time
 * `v.parse(toEnrichmentSchema(), { subject, generator, stack })`, swapping
 * `parse` for `safeParse` to collect rather than throw.
 */
const parseScope = (
  schema: v.GenericSchema,
  scope: EnrichmentValidationScope,
  value: unknown,
  tag: Omit<EnrichmentValidationIssue, 'scope' | 'field' | 'message'>
): EnrichmentValidationIssue[] => {
  const raw: Record<EnrichmentValidationScope, unknown> = {
    subject: undefined,
    generator: undefined,
    stack: undefined
  }
  raw[scope] = value

  const result = v.safeParse(schema, raw)
  if (result.success) return []

  return result.issues
    .filter(issue => firstKey(issue.path) === scope)
    .map(issue => {
      const field = fieldPath(issue.path)
      return {
        ...tag,
        scope,
        ...(field !== undefined ? { field } : {}),
        message: issue.message
      }
    })
}

/**
 * The single enrichment-validation authority. Validates every enrichment
 * value in `enrichments` against its owning generator's Valibot enrichment
 * schema (`toEnrichmentSchema`) — composed across the supplied generator
 * `sources` — and returns the flat list of value errors. This is the same
 * Valibot that the engine parses at generate time; `validateConfig` exposes
 * it as a standalone, **documentless** check (no OpenAPI/SDL needed — only
 * the values and the schemas), usable wherever a verdict is needed:
 * pre-persist, CLI push, schema-drift migration, and the Publish gate.
 *
 * Scope of this check (value validity only):
 *  - **catches** wrong-typed / missing-required / failed-refinement values
 *    against the current schema, and a generator configured but absent from
 *    the stack (`scope: 'generator'`, "not present in the stack").
 *  - **does not** flag unknown *fields* — Valibot's `v.object` strips
 *    unknown keys rather than erroring. Field-level referential drift ("this
 *    key is no longer in the schema") is the descriptor referential check's
 *    job, not this one.
 *  - **does not** resolve subjects against a document — subject *existence*
 *    (does this path/refName exist) needs the schema document and is the
 *    caller's concern.
 *
 * `sources` mirrors {@link toEnrichmentDescriptor}'s input: pass
 * `Object.values(toGeneratorConfigMap())`. The walk is decoupled from
 * `GeneratorConfig` via {@link EnrichmentSource} so tests can pass plain
 * entry-like objects.
 */
export const validateConfig = (
  enrichments: GeneratorEnrichments | undefined,
  sources: readonly EnrichmentSource[]
): EnrichmentValidationIssue[] => {
  if (!isRecord(enrichments)) return []

  const sourceById = new Map(sources.map(source => [source.id, source]))
  const stack = enrichments[STACK_ENRICHMENT_KEY]
  const issues: EnrichmentValidationIssue[] = []

  for (const [generatorId, slot] of Object.entries(enrichments)) {
    if (generatorId === STACK_ENRICHMENT_KEY) continue
    // Other `_`-prefixed top-level keys are reserved/unknown — the
    // `generatorEnrichments` schema flags those structurally, not here.
    if (isReservedEnrichmentKey(generatorId)) continue

    const source = sourceById.get(generatorId)
    if (!source) {
      issues.push({
        generator: generatorId,
        scope: 'generator',
        message: `Generator '${generatorId}' has enrichments configured but is not present in the stack.`
      })
      continue
    }

    const schema = source.toEnrichmentSchema?.()
    if (!schema || !isRecord(slot)) continue

    // Run-constant scopes — validated once per generator (each generator's
    // umbrella declares its own `generator` / `stack` member shape).
    issues.push(...parseScope(schema, 'generator', slot[GENERATOR_ENRICHMENT_KEY], { generator: generatorId }))
    issues.push(...parseScope(schema, 'stack', stack, { generator: generatorId }))

    // Subject scope — one parse per (subject, variant) leaf.
    for (const leaf of collectSubjectLeaves(source.type, slot)) {
      issues.push(
        ...parseScope(schema, 'subject', leaf.values, {
          generator: generatorId,
          subject: leaf.subject,
          ...(leaf.method !== undefined ? { method: leaf.method } : {}),
          variant: leaf.variant
        })
      )
    }
  }

  return issues
}
