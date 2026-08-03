import { camelCase, toOasOperationEntry, toOasOperationGeneratorKey } from '@skmtc/core'
import { createClass, defineAndRegister } from '@skmtc/lang-typescript'
import { join } from '@std/path'
import { ApiClientClass } from './ApiClientClass.ts'
import { toClientMethod } from './ClientMethod.ts'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const apiClientEntry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,

  toEnrichmentSchema,

  transform({ context, operation }) {
    const tag = operation.tags?.[0] ?? 'api'
    const className = `${camelCase(tag, { upperFirst: true })}Client`
    const exportPath = join('@', 'client', `${className}.generated.ts`)

    const generatorKey = toOasOperationGeneratorKey({
      generatorId: denoJson.name,
      path: operation.path,
      method: operation.method
    })

    const existing = context.findDefinition({ name: className, exportPath })

    const clientClass =
      existing?.value instanceof ApiClientClass
        ? existing.value
        : defineAndRegister(context, {
            identifier: createClass(className),
            value: new ApiClientClass({ generatorKey }),
            destinationPath: exportPath
          }).value

    clientClass.addMethod(
      toClientMethod({ context, operation, destinationPath: exportPath, generatorKey })
    )
  }
})
