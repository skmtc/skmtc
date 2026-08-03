import { toOasOperationEntry } from '@skmtc/core'
import { createClass, defineAndRegister } from '@skmtc/lang-typescript'
import denoJson from '../deno.json' with { type: 'json' }
import { ClientClass } from './ClientClass.ts'
import { ClientMethod } from './ClientMethod.ts'
import { toApiTag, toClientExportPath, toClientName } from './base.ts'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'

export const apiClientEntry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  transform({ context, operation }) {
    const tag = toApiTag(operation)
    const name = toClientName(tag)
    const exportPath = toClientExportPath(tag)

    // Accumulator get-or-create: the cache probe IS the coordination.
    const existing = context.findDefinition({ name, exportPath })

    const client =
      existing?.value instanceof ClientClass
        ? existing.value
        : defineAndRegister(context, {
            identifier: createClass(name),
            value: new ClientClass({ context }),
            destinationPath: exportPath
          }).value

    client.add(new ClientMethod({ context, operation, destinationPath: exportPath }))
  }
})
