/**
 * @fileoverview The shared umbrella-parse seam for the projection-base
 * factories.
 *
 * Every `static toEnrichments` — OAS operation, webhook, GQL operation,
 * model — assembles the same `{ subject, generator, stack }` umbrella
 * from three storage spots and parses it through the generator's
 * composite schema. This helper centralizes that assembly so both
 * enrichment-validation mechanisms ride one seam:
 *
 *  - the reads go through `context.readEnrichment` — the recording
 *    accessor feeding the consumption audit (`EnrichmentAudit`);
 *  - the raw values are diffed against the schema (`findUnknownKeys`)
 *    and dropped keys surface as `UNKNOWN_ENRICHMENT_KEY` warnings.
 *
 * The `stack` scope is exempt from unknown-key detection: it is a single
 * bag shared by every generator in the composition, and each consumer
 * declares only the fields it reads — keys other generators own are
 * expected, not typos.
 *
 * A wrong-typed value still throws exactly as before — the `v.parse` at
 * the end is unchanged, and unknown-key detection runs first so a
 * throwing leaf doesn't hide a dropped key.
 *
 * @module parseEnrichmentUmbrella
 */

import * as v from 'valibot'
import { GENERATOR_ENRICHMENT_KEY, STACK_ENRICHMENT_KEY } from '@/types/Enrichments.ts'
import { findUnknownKeys } from '@/enrichments/findUnknownKeys.ts'
import { formatEnrichmentPath, type EnrichmentWarning } from '@/enrichments/EnrichmentWarning.ts'

/**
 * Minimal structural view of the context the parse needs. Any
 * `GenerateContext` satisfies it; kept structural so the helper stays
 * decoupled from the full context type and is trivially testable.
 */
type UmbrellaParseContext = {
  readEnrichment: (segments: readonly string[]) => unknown
  reportEnrichmentWarning: (warning: EnrichmentWarning) => void
}

type ParseEnrichmentUmbrellaArgs<EnrichmentType> = {
  context: UmbrellaParseContext
  generatorId: string
  /**
   * Subject routing segments under `[generatorId]`, including the
   * variant — `[path, method, variant]` for OAS operations,
   * `[name, method, variant]` for webhooks,
   * `[rootKind, fieldName, variant]` for GQL operations,
   * `[refName, variant]` for models.
   *
   * Omitted for a subject-less umbrella: a container is a place many
   * subjects insert into, so no one subject's enrichment describes it, and
   * the `subject` scope is left out entirely rather than read and ignored —
   * reading it would both mislead the consumption audit and report a
   * member's legitimate per-operation key as unknown.
   */
  subjectSegments?: readonly string[]
  /** The generator's composite `{ subject, generator, stack }` schema. */
  schema: v.GenericSchema<EnrichmentType>
}

/**
 * Assemble and parse one `{ subject, generator, stack }` enrichment
 * umbrella, recording the reads for the consumption audit and reporting
 * schema-dropped keys.
 *
 * @throws on a wrong-typed value, exactly like the raw `v.parse` this
 *   wraps — the generator's item is then recorded as `error` and the run
 *   continues (fail-open).
 */
export const parseEnrichmentUmbrella = <EnrichmentType>({
  context,
  generatorId,
  subjectSegments,
  schema
}: ParseEnrichmentUmbrellaArgs<EnrichmentType>): EnrichmentType => {
  const raw = {
    ...(subjectSegments
      ? { subject: context.readEnrichment([generatorId, ...subjectSegments]) }
      : {}),
    generator: context.readEnrichment([generatorId, GENERATOR_ENRICHMENT_KEY]),
    stack: context.readEnrichment([STACK_ENRICHMENT_KEY])
  }

  // Diff the generator-owned scopes against the schema (stack excluded —
  // shared bag). Walking the umbrella keeps the scope schemas attributed
  // without reaching into the composite's entries.
  const unknownKeys = findUnknownKeys(schema, {
    ...('subject' in raw ? { subject: raw.subject } : {}),
    generator: raw.generator
  })

  for (const { path, suggestion } of unknownKeys) {
    const [scope, ...leafPath] = path
    const routingPath =
      scope === 'subject' && subjectSegments
        ? [generatorId, ...subjectSegments, ...leafPath]
        : [generatorId, GENERATOR_ENRICHMENT_KEY, ...leafPath]

    context.reportEnrichmentWarning({
      level: 'warning',
      type: 'UNKNOWN_ENRICHMENT_KEY',
      path: routingPath,
      message:
        `unknown enrichment key '${routingPath[routingPath.length - 1]}' at ` +
        `'${formatEnrichmentPath(routingPath.slice(0, -1))}' — ignored` +
        (suggestion !== undefined ? ` (did you mean '${suggestion}'?)` : ''),
      ...(suggestion !== undefined ? { suggestion } : {})
    })
  }

  return v.parse(schema, raw)
}
