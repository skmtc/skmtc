import { OasVoid, decapitalize, toEndpointName, type GenerateContextType, type OasOperation } from '@skmtc/core'
import { TsSnippet, toPathTemplate } from '@skmtc/lang-typescript'
import { ZodProjection } from '@skmtc/gen-zod'

type ConstructorArgs = {
  context: GenerateContextType
  operation: OasOperation
  destinationPath: string
}

export class ClientMethod extends TsSnippet {
  private name: string
  private path: string
  private method: string
  private pathParams: string[]
  private hasBody: boolean
  private zodName: string

  constructor({ context, operation, destinationPath }: ConstructorArgs) {
    super({ context })
    this.name = decapitalize(toEndpointName(operation))
    this.path = operation.path
    this.method = operation.method
    this.pathParams = operation.toParams(['path']).map(p => p.name)
    
    const requestBody = operation.toRequestBody(({ schema }) => schema)
    this.hasBody = requestBody !== undefined
    
    const responseSchema = operation.toSuccessResponse()?.resolve().toSchema() ?? OasVoid.empty()
    const definition = context.insertNormalizedModel(ZodProjection, {
      schema: responseSchema,
      fallbackName: `${this.name}Response`,
      destinationPath
    })
    this.zodName = definition.identifier.name
  }

  override toString(): string {
    const params = [
      ...this.pathParams.map((p: string) => `${p}: string`),
      ...(this.hasBody ? ['body: unknown'] : [])
    ].join(', ')
    const fetchOptions = this.hasBody ? `, body: JSON.stringify(body)` : ''

    return `  async ${this.name}(${params}): Promise<unknown> {
    const res = await fetch(\`${toPathTemplate(this.path)}\`, { method: '${this.httpMethod}'${fetchOptions} })
    return ${this.zodName}.parse(await res.json())
  }`
  }
}
