import * as v from 'valibot'
import { formatEnrichmentPath } from '@/enrichments/EnrichmentWarning.ts'

type ParseEnrichmentValueArgs<EnrichmentType> = {
  schema: v.GenericSchema<EnrichmentType>
  value: unknown
  /** The generator whose schema reads `value`; `undefined` for the shared `_stack` bag. */
  generatorId: string | undefined
  /** The `client.json#settings.enrichments` routing path of the value at `path` inside `value`. */
  toRoutingPath: (path: readonly string[]) => string[]
}

/**
 * `value` parsed through a generator's enrichment schema. Enrichments are
 * typed configuration, so a value that does not match throws, and the run
 * fails. The message lists every value that does not match, at its place in
 * `client.json`, so the user can fix them all in one pass.
 */
export const parseEnrichmentValue = <EnrichmentType>({
  schema,
  value,
  generatorId,
  toRoutingPath
}: ParseEnrichmentValueArgs<EnrichmentType>): EnrichmentType => {
  const result = v.safeParse(schema, value)

  if (result.success) {
    return result.output
  }

  const lines = result.issues.map(issue => {
    const path = (issue.path ?? []).map(item => String(item.key))
    const at = formatEnrichmentPath(toRoutingPath(path))

    return `- '${at}': ${toFix(issue, generatorId)}`
  })

  const header =
    generatorId === undefined
      ? 'Stack enrichments do not match the schema a generator reads them with.'
      : `Enrichments for '${generatorId}' do not match its enrichment schema.`

  throw new Error(
    [`${header} Fix them in client.json (settings.enrichments):`, ...lines].join('\n')
  )
}

/** What to do about one value: a scope the generator does not read takes no value at all. */
const toFix = (issue: v.BaseIssue<unknown>, generatorId: string | undefined): string => {
  if (issue.expected !== 'undefined') {
    return issue.message
  }

  return generatorId === undefined
    ? 'No generator reads a value here. Remove the value.'
    : `'${generatorId}' reads no enrichments here. Remove the value.`
}
