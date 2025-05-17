import { decapitalize, camelCase, Identifier, toModelInsertable, type RefName } from '@skmtc/core'
import { join } from '@std/path'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'

export const ZodBase = toModelInsertable<EnrichmentSchema>({
  id: '@skmtc/zod',

  toEnrichmentSchema,

  toIdentifier(refName: RefName): Identifier {
    const name = decapitalize(camelCase(refName))

    return Identifier.createVariable(name)
  },

  toExportPath(_refName: RefName): string {
    return join('@', `index.generated.tsx`)
  }
})
