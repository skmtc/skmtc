import { OasVoid, decapitalize, toEndpointName, type GenerateContextType, type OasOperation } from '@skmtc/core'
import { TsSnippet, toPathTemplate } from '@skmtc/lang-typescript'
import { ZodProjection } from '@skmtc/gen-zod'

type ConstructorArgs = {
  context: GenerateContextType
  operation: OasOperation
  destinationPath: string
}

export class ClientMethod extends TsSnippet {
  name: string
  path: string
  method: string
  pathParams: string[]
  hasBody: boolean
  /** The response schema's identifier NAME — the definition itself is
   *  produced through gen-zod's projection via the engine, which also
   *  stitches the cross-file import. A cached name is a legit string leaf. */
  zodName: string

  constructor({ context, operation, destinationPath }: ConstructorArgs) {
    super({ context })

    this.name = decapitalize(toEndpointName(operation))
    this.path = operation.path
    this.method = operation.method
    this.pathParams = operation.toParams(['path']).map(parameter => parameter.name)
    this.hasBody = Boolean(operation.toRequestBody(({ schema }) => schema))

    const responseSchema =
      operation.toSuccessResponse()?.resolve().toSchema() ?? OasVoid.empty()

    const zodDefinition = context.insertNormalizedModel(ZodProjection, {
      schema: responseSchema,
      fallbackName: `${this.name}Response`,
      destinationPath
    })

    this.zodName = zodDefinition.identifier.name
  }

  override toString(): string {
    const parameters = [
      ...this.pathParams.map(name => `${name}: string`),
      ...(this.hasBody ? ['body: unknown'] : [])
    ].join(', ')

    const bodyLine = this.hasBody ? `,\n      body: JSON.stringify(body)` : ''

    return `async ${this.name}(${parameters}) {
    const res = await fetch(\`${toPathTemplate(this.path)}\`, {
      method: '${this.method.toUpperCase()}'${bodyLine}
    })
    return ${this.zodName}.parse(await res.json())
  }`
  }
}
