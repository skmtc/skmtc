import type { GenerateContextType, OasOperation, OasRef, OasSchema } from '@skmtc/core'
import { ZodProjection } from '@skmtc/gen-zod'
import { TsMethod, register, toPathTemplate } from '@skmtc/lang-typescript'
import { toMethodName } from './naming.ts'

/** Router for the TS annotation of a path/query parameter. */
const toParamTypeValue = (schema: OasSchema | OasRef<'schema'>): string => {
  switch (schema.resolve().type) {
    case 'string':
      return 'string'
    case 'integer':
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    default:
      return 'string'
  }
}

type ToClientMethodArgs = {
  context: GenerateContextType
  operation: OasOperation
  destinationPath: string
}

/**
 * Build one client method for an operation. Response and request-body
 * schemas are projected through gen-zod via the engine, so named models
 * land once in their own files with imports stitched into the client file.
 */
export const toClientMethod = ({
  context,
  operation,
  destinationPath
}: ToClientMethodArgs): TsMethod => {
  const methodName = toMethodName(operation)

  const parameters = operation
    .toParams(['path'])
    .map(param => `${param.name}: ${toParamTypeValue(param.toSchema())}`)

  const bodySchema = operation.toRequestBody(({ schema }) => schema)

  if (bodySchema) {
    const bodyDefinition = context.insertNormalizedModel(ZodProjection, {
      schema: bodySchema,
      fallbackName: `${methodName}Body`,
      destinationPath
    })

    register(context, { imports: { zod: ['z'] }, destinationPath })

    parameters.push(`body: z.infer<typeof ${bodyDefinition.identifier.name}>`)
  }

  const url = '`${this.baseUrl}' + toPathTemplate(operation.path) + '`'

  const init = bodySchema
    ? `, { method: '${operation.method.toUpperCase()}', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }`
    : operation.method === 'get'
      ? ''
      : `, { method: '${operation.method.toUpperCase()}' }`

  const statements = [`const res = await fetch(${url}${init});`]

  const responseSchema = operation.toSuccessResponse()?.resolve().toSchema('application/json')

  if (responseSchema) {
    const responseDefinition = context.insertNormalizedModel(ZodProjection, {
      schema: responseSchema,
      fallbackName: `${methodName}Response`,
      destinationPath
    })

    statements.push(`return ${responseDefinition.identifier.name}.parse(await res.json());`)
  }

  return new TsMethod({
    name: methodName,
    async: true,
    parameters,
    body: statements.join('\n')
  })
}
