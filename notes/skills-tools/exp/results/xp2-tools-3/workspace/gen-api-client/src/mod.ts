import { camelCase, capitalize, toOasOperationEntry, toOasOperationGeneratorKey } from '@skmtc/core'
import { createClass, defineAndRegister } from '@skmtc/lang-typescript'
import { join } from '@std/path'
import denoJson from '../deno.json' with { type: 'json' }
import { ApiClient } from './ApiClient.ts'
import { ClientMethod } from './ClientMethod.ts'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'

export const apiClientEntry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,

  toEnrichmentSchema,

  transform({ context, operation, variant }) {
    const tag = operation.tags?.[0] ?? 'api'
    const className = `${capitalize(camelCase(tag))}Client`
    const exportPath = join('@', 'client', `${className}.generated.ts`)

    const generatorKey = toOasOperationGeneratorKey({
      generatorId: denoJson.name,
      operation,
      variant
    })

    const method = new ClientMethod({
      context,
      operation,
      destinationPath: exportPath,
      generatorKey
    })

    const existing = context.findDefinition({ name: className, exportPath })

    if (existing?.value instanceof ApiClient) {
      existing.value.add(method)
      return
    }

    const definition = defineAndRegister(context, {
      identifier: createClass(className),
      value: new ApiClient({ context, generatorKey }),
      destinationPath: exportPath
    })

    definition.value.add(method)
  }
})
