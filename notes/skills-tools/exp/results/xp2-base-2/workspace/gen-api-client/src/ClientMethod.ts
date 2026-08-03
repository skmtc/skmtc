import { OasVoid } from '@skmtc/core'
import type {
  OasOperationProjectionConstructorArgs,
  OasRef,
  OasSchema
} from '@skmtc/core'
import { TsMethod, toPathTemplate } from '@skmtc/lang-typescript'
import { ZodProjection } from '@skmtc/gen-zod'
import { ApiClientBase } from './base.ts'
import type { EnrichmentSchema } from './enrichments.ts'
import { toMethodName } from './naming.ts'

const toParamType = (schema: OasSchema | OasRef<'schema'>): string => {
  const resolved = schema.isRef() ? schema.resolve() : schema

  switch (resolved.type) {
    case 'integer':
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    default:
      return 'string'
  }
}

export class ClientMethod extends ApiClientBase {
  method: TsMethod

  constructor({
    context,
    operation,
    settings
  }: OasOperationProjectionConstructorArgs<EnrichmentSchema>) {
    super({ context, operation, settings })

    const name = toMethodName(operation)

    const parameters = operation
      .toParams(['path'])
      .map(param => `${param.name}: ${toParamType(param.toSchema())}`)

    const fetchOptions = [`method: '${operation.method.toUpperCase()}'`]

    const bodySchema = operation.toRequestBody(({ schema }) => schema)

    if (bodySchema) {
      const bodyZod = this.insertNormalizedModel(ZodProjection, {
        schema: bodySchema,
        fallbackName: `${name}Body`
      })

      this.register({
        imports: { zod: ['z'] },
        destinationPath: this.settings.exportPath
      })

      parameters.push(`body: z.input<typeof ${bodyZod.identifier.name}>`)

      fetchOptions.push(`headers: { 'Content-Type': 'application/json' }`)
      fetchOptions.push('body: JSON.stringify(body)')
    }

    const responseZod = this.insertNormalizedModel(ZodProjection, {
      schema: operation.toSuccessResponse()?.resolve().toSchema() ?? OasVoid.empty(),
      fallbackName: `${name}Response`
    })

    this.method = new TsMethod({
      name,
      async: true,
      parameters,
      body: `const res = await fetch(\`${toPathTemplate(operation.path)}\`, {
    ${fetchOptions.join(',\n    ')}
  })

  if (!res.ok) {
    throw new Error(await res.text())
  }

  return ${responseZod.identifier.name}.parse(await res.json())`
    })
  }

  override toString(): string {
    return `${this.method}`
  }
}
