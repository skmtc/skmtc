/**
 * Headless variant-axis migration for a project's `client.json`.
 *
 * Idempotent — re-running on an already-migrated file leaves it
 * unchanged.
 *
 * Two transforms applied in sequence:
 *
 *   1. **Enrichment wrap** — every operation-level enrichment block
 *      (under `settings.enrichments[generatorId][path][method]` for
 *      OAS or `[rootKind][fieldName]` for GraphQL) gets wrapped in
 *      `{ "main": <existing block> }` if not already shaped that way.
 *
 *   2. **Skip/include reshape** — every operation-shaped entry in
 *      `settings.skip` and `settings.include` migrates from the old
 *      `{ path: [method[]] }` shape to the new
 *      `{ path: { method: [variants...] } }` shape, with `[]`
 *      (empty variant array) meaning "all variants of this method"
 *      — the same semantics as the old all-methods form.
 *
 * Model-shaped entries (string[] under a generator id) and bare-
 * string entries (whole-generator) are left alone — models have no
 * variant axis.
 */

import { join } from '@std/path/join'
import { toProjectPath } from '@/lib/to-project-path.ts'

const HTTP_METHODS: ReadonlySet<string> = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'trace'
])

const GQL_ROOT_KINDS: ReadonlySet<string> = new Set(['query', 'mutation', 'subscription'])

export type MigrateVariantsResult = {
  projectPath: string
  clientJsonPath: string
  alreadyMigrated: boolean
  enrichmentsWrapped: Array<{ generatorId: string; routingKey: string }>
  skipReshape: number
  includeReshape: number
  beforeBytes: number
  afterBytes: number
}

type Filter = unknown[]

const wrapOperationEnrichments = (
  enrichments: Record<string, unknown>,
  wrapped: Array<{ generatorId: string; routingKey: string }>
): void => {
  for (const [generatorId, byPath] of Object.entries(enrichments)) {
    if (byPath === null || typeof byPath !== 'object' || Array.isArray(byPath)) continue

    for (const [routingKey, byInner] of Object.entries(byPath as Record<string, unknown>)) {
      // Routing key shape decides whether this is an operation-keyed
      // entry. OAS uses a path starting with `/`; GraphQL uses a
      // root-type name (`query` / `mutation` / `subscription`).
      const isOasPath = routingKey.startsWith('/')
      const isGqlRoot = GQL_ROOT_KINDS.has(routingKey)
      if (!isOasPath && !isGqlRoot) continue

      if (byInner === null || typeof byInner !== 'object' || Array.isArray(byInner)) continue

      const innerKey = isOasPath ? 'method' : 'fieldName'
      const innerSet = isOasPath ? HTTP_METHODS : null

      for (const [innerName, leaf] of Object.entries(byInner as Record<string, unknown>)) {
        if (innerSet && !innerSet.has(innerName.toLowerCase())) continue
        if (leaf === null || typeof leaf !== 'object' || Array.isArray(leaf)) continue

        const leafKeys = Object.keys(leaf as Record<string, unknown>)
        if (leafKeys.includes('main')) continue // already migrated

        // Wrap.
        ;(byInner as Record<string, unknown>)[innerName] = { main: leaf }
        wrapped.push({
          generatorId,
          routingKey: `${routingKey} ${innerKey}=${innerName}`
        })
      }
    }
  }
}

const reshapeOperationFilters = (filters: Filter): number => {
  let migrated = 0
  for (const entry of filters) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue

    for (const [_generatorId, genVal] of Object.entries(entry as Record<string, unknown>)) {
      if (genVal === null || typeof genVal !== 'object' || Array.isArray(genVal)) continue

      const genEntry = genVal as Record<string, unknown>

      for (const [pathKey, value] of Object.entries(genEntry)) {
        // Only operation-keyed entries (path starts with `/`). Model-
        // shaped entries have refName arrays directly under the
        // generator id.
        if (!pathKey.startsWith('/')) continue
        if (!Array.isArray(value)) continue

        // Old shape: array of method strings → new shape:
        // `{ method: [] }` for each, meaning "every variant of this
        // method".
        const reshaped: Record<string, string[]> = {}
        for (const m of value) {
          if (typeof m === 'string' && HTTP_METHODS.has(m.toLowerCase())) {
            reshaped[m] = []
          }
        }
        genEntry[pathKey] = reshaped
        migrated++
      }
    }
  }
  return migrated
}

export const migrateVariantsHeadless = async ({
  projectName
}: {
  projectName: string
}): Promise<MigrateVariantsResult> => {
  const projectPath = toProjectPath(projectName)
  const clientJsonPath = join(projectPath, '.settings', 'client.json')

  const source = await Deno.readTextFile(clientJsonPath)
  const beforeBytes = new TextEncoder().encode(source).length
  // deno-lint-ignore no-explicit-any — JSON shape is validated downstream
  const data = JSON.parse(source) as any

  const settings = data?.settings as Record<string, unknown> | undefined
  if (!settings) {
    return {
      projectPath,
      clientJsonPath,
      alreadyMigrated: true,
      enrichmentsWrapped: [],
      skipReshape: 0,
      includeReshape: 0,
      beforeBytes,
      afterBytes: beforeBytes
    }
  }

  const wrapped: Array<{ generatorId: string; routingKey: string }> = []
  const enrichments = settings.enrichments as Record<string, unknown> | undefined
  if (enrichments) {
    wrapOperationEnrichments(enrichments, wrapped)
  }

  const skipCount = settings.skip ? reshapeOperationFilters(settings.skip as Filter) : 0
  const includeCount = settings.include ? reshapeOperationFilters(settings.include as Filter) : 0

  const alreadyMigrated = wrapped.length === 0 && skipCount === 0 && includeCount === 0

  const next = JSON.stringify(data, null, 2) + '\n'

  if (!alreadyMigrated) {
    await Deno.writeTextFile(clientJsonPath, next)
  }

  return {
    projectPath,
    clientJsonPath,
    alreadyMigrated,
    enrichmentsWrapped: wrapped,
    skipReshape: skipCount,
    includeReshape: includeCount,
    beforeBytes,
    afterBytes: new TextEncoder().encode(next).length
  }
}
