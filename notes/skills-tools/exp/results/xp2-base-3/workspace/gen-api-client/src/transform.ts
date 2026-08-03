import { camelCase, capitalize } from '@skmtc/core'
import type {
  GenerateContextType,
  OasOperation,
  OasRef,
  OasSchema,
  TransformOasOperationArgs
} from '@skmtc/core'
import {
  TsClass,
  TsMethod,
  createClass,
  defineAndRegister,
  register,
  toPathTemplate
} from '@skmtc/lang-typescript'
import { ZodProjection } from '@skmtc/gen-zod'

const toClassName = (tag: string): string => `${capitalize(camelCase(tag))}Client`

// Deterministic method name from method + path: `GET /orders/{id}` -> `getOrdersId`
const toMethodName = ({ method, path }: OasOperation): string => {
  const segments = path
    .split('/')
    .filter(segment => segment.length > 0)
    .map(segment => capitalize(camelCase(segment.replaceAll(/[{}]/g, ''))))

  return `${method.toLowerCase()}${segments.join('')}`
}

const toParamTsType = (schema: OasSchema | OasRef<'schema'> | undefined): string => {
  const resolved = schema === undefined ? undefined : schema.isRef() ? schema.resolve() : schema

  switch (resolved?.type) {
    case 'integer':
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    default:
      return 'string'
  }
}

// Get-or-create the tag's accumulating class value; the definition (and its
// file) is registered exactly once, methods are added across transform calls.
const toClientClass = (
  context: GenerateContextType,
  { className, destinationPath }: { className: string; destinationPath: string }
): TsClass => {
  const cached = context.findDefinition({ name: className, exportPath: destinationPath })

  if (cached !== undefined && cached.value instanceof TsClass) {
    return cached.value
  }

  return defineAndRegister(context, {
    identifier: createClass(className),
    value: new TsClass(),
    destinationPath
  }).value
}

export const transformOperation = ({ context, operation }: TransformOasOperationArgs): void => {
  const tag = operation.tags?.at(0) ?? 'default'
  const className = toClassName(tag)
  const destinationPath = `@/client/${className}.generated.ts`

  const clientClass = toClientClass(context, { className, destinationPath })

  const methodName = toMethodName(operation)

  const parameters = operation
    .toParams(['path'])
    .map(param => `${param.name}: ${toParamTsType(param.schema)}`)

  const bodySchema = operation.toRequestBody(({ schema }) => schema)

  if (bodySchema !== undefined) {
    const bodyDefinition = context.insertNormalizedModel(ZodProjection, {
      schema: bodySchema,
      fallbackName: `${methodName}Body`,
      destinationPath
    })

    register(context, { imports: { zod: ['z'] }, destinationPath })

    parameters.push(`body: z.infer<typeof ${bodyDefinition.identifier.name}>`)
  }

  const responseSchema = operation.toSuccessResponse()?.resolve().toSchema()

  const returnLine =
    responseSchema === undefined
      ? 'return await res.json()'
      : `return ${
          context.insertNormalizedModel(ZodProjection, {
            schema: responseSchema,
            fallbackName: `${methodName}Response`,
            destinationPath
          }).identifier.name
        }.parse(await res.json())`

  const requestInitEntries = [
    operation.method === 'get' ? undefined : `method: '${operation.method.toUpperCase()}'`,
    bodySchema === undefined ? undefined : `headers: { 'Content-Type': 'application/json' }`,
    bodySchema === undefined ? undefined : 'body: JSON.stringify(body)'
  ].filter(entry => entry !== undefined)

  const requestInit = requestInitEntries.length ? `, { ${requestInitEntries.join(', ')} }` : ''

  const fetchLine = `const res = await fetch(\`${toPathTemplate(operation.path)}\`${requestInit})`

  clientClass.addMethod(
    new TsMethod({
      name: methodName,
      async: true,
      parameters,
      body: `${fetchLine}\n${returnLine}`,
      description: operation.summary
    })
  )
}
