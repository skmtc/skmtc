/**
 * `skmtc migrate variants <project>` — migrates a project's
 * `client.json` to the variant-aware shape introduced in
 * `@skmtc/core@0.5.0`.
 *
 * What changes:
 *   - Operation-level enrichments wrap their existing leaf in
 *     `{ "main": <leaf> }`.
 *   - `skip` / `include` per-operation entries reshape from
 *     `{ path: [methods] }` to `{ path: { method: [variants] } }`
 *     with `[]` meaning "all variants of this method".
 *
 * Idempotent — re-running on an already-migrated `client.json` is
 * a no-op (reports as such in JSON output).
 */

import {
  migrateVariantsHeadless,
  type MigrateVariantsResult
} from '@/lib/migrate-variants-headless.ts'
import { resolveOutputFormat } from '@/lib/strict-mode.ts'

type RenderMigrateVariantsArgs = {
  projectName: string
  jsonFlag?: boolean
}

export const renderMigrateVariants = async ({
  projectName,
  jsonFlag
}: RenderMigrateVariantsArgs): Promise<void> => {
  const result = await migrateVariantsHeadless({ projectName })
  printMigrateVariantsResult(result, { format: resolveOutputFormat({ jsonFlag }) })
}

type PrintOptions = {
  format: 'text' | 'json'
}

const printMigrateVariantsResult = (
  result: MigrateVariantsResult,
  { format }: PrintOptions
): void => {
  switch (format) {
    case 'json': {
      console.log(JSON.stringify(result, null, 2))
      return
    }
    case 'text': {
      if (result.alreadyMigrated) {
        console.log(`No changes needed: ${result.clientJsonPath} is already variant-shaped.`)
        return
      }

      console.log(`Migrated ${result.clientJsonPath}`)
      if (result.enrichmentsWrapped.length > 0) {
        console.log(`  Wrapped ${result.enrichmentsWrapped.length} operation enrichment(s):`)
        for (const w of result.enrichmentsWrapped) {
          console.log(`    - ${w.generatorId} → ${w.routingKey}`)
        }
      }
      if (result.skipReshape > 0) {
        console.log(`  Reshaped ${result.skipReshape} skip entry/entries.`)
      }
      if (result.includeReshape > 0) {
        console.log(`  Reshaped ${result.includeReshape} include entry/entries.`)
      }
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
