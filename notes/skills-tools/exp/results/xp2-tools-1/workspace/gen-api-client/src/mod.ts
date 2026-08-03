import { toOasOperationEntry } from '@skmtc/core'
import type { Stringable } from '@skmtc/core'
import { TsMethod, createClass, defineAndRegister } from '@skmtc/lang-typescript'
import { ClientClass } from './ClientClass.ts'
import { MethodBody } from './MethodBody.ts'
import { PathParam } from './PathParam.ts'
import { BodyParam } from './BodyParam.ts'
import { toClientName, toClientPath, toMethodName } from './identifiers.ts'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const apiClientEntry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,

  toEnrichmentSchema,

  transform: ({ context, operation }) => {
    const tag = operation.tags?.[0] ?? 'api'
    const clientName = toClientName(tag)
    const exportPath = toClientPath(tag)

    const existing = context.findDefinition({ name: clientName, exportPath })

    const definition =
      existing?.value instanceof ClientClass
        ? existing
        : defineAndRegister(context, {
            identifier: createClass(clientName),
            value: new ClientClass({ context, operation }),
            destinationPath: exportPath
          })

    if (!(definition.value instanceof ClientClass)) {
      return
    }

    const methodBody = new MethodBody({ context, operation, destinationPath: exportPath })

    const parameters: Stringable[] = operation
      .toParams(['path'])
      .map(parameter => new PathParam({ context, parameter }))

    if (methodBody.bodyName !== undefined) {
      parameters.push(
        new BodyParam({ context, schemaName: methodBody.bodyName, destinationPath: exportPath })
      )
    }

    definition.value.clientClass.addMethod(
      new TsMethod({
        name: toMethodName(operation),
        async: true,
        parameters,
        body: methodBody
      })
    )
  }
})
