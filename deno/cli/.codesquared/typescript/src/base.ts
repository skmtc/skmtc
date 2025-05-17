import { capitalize, camelCase, Identifier, toModelInsertable, type RefName } from '@skmtc/core'
import { join } from '@std/path'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'

export const TypescriptBase = toModelInsertable<EnrichmentSchema>({
  id: '@skmtc/typescript',
  toEnrichmentSchema,
  toIdentifier(refName: RefName): Identifier {
    const name = capitalize(camelCase(refName))

    return Identifier.createType(name)
  },

  toExportPath(_refName: RefName): string {
    return join('@', `index.generated.tsx`)
  }
})
