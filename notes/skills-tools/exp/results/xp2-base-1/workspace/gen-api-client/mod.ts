import { toOasOperationEntry, emptyEnrichmentSchema, type EmptyEnrichments } from '@skmtc/core'
import { TagClient } from './src/TagClient.ts'
import { toClientName, toClientPath } from './src/naming.ts'
import denoJson from './deno.json' with { type: 'json' }

export const apiClientEntry = toOasOperationEntry<EmptyEnrichments>({
  id: denoJson.name,
  toEnrichmentSchema: () => emptyEnrichmentSchema,
  transform({ context, operation }) {
    // The first operation of a tag builds the whole client class (see
    // TagClient); later operations of the same tag find the definition
    // and skip, so each tag's class and file are created exactly once.
    const exists = context.findDefinition({
      name: toClientName(operation),
      exportPath: toClientPath(operation)
    })

    if (exists) {
      return
    }

    context.insertOperation({ projection: TagClient, operation })
  }
})

export default apiClientEntry
