import {
  capitalize,
  Identifier,
  toEndpointName,
  toOperationInsertable
} from '@skmtc/core'
import { join } from '@std/path'
import { tanstackQueryConfig } from './config.ts'
export { type EnrichmentSchema } from './config.ts'

export const TanstackQueryBase = toOperationInsertable({
  ...tanstackQueryConfig,

  toIdentifier(operation): Identifier {
    const name = `use${capitalize(toEndpointName(operation))}`

    return Identifier.createVariable(name)
  },

  toExportPath(): string {
    return join('@', `index.generated.tsx`)
  }
})
