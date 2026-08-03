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
  zodName: string

  constructor({ context, operation, destinationPath }: ConstructorArgs) {
    super({ context })
    this.name = decapitalize(toEndpointName(operation))
    this.path = operation.path
    this.method = operation.method
    this.pathParams = operation.toParams(['path']).map((p) => p.name)
    this.hasBody = operation.toRequestBody(({ schema }) => schema) !== undefined
    const responseSchema = operation.toSuccessResponse()?.resolve().toSchema() ?? OasVoid.empty()
    const definition = context.insertNormalizedModel(ZodProjection, {
      schema: responseSchema,
      fallbackName: `${this.name}Response`,
      destinationPath,
    })
    this.zodName = definition.identifier.name
  }

  override toString(): string {
return `  async ${this.name}(${this.pathParams.map(p => `${p}: string`).concat(this.hasBody ? ['body: unknown'] : []).join(', ')}) {
    const res = await fetch(\`${toPathTemplate(this.path)}\`, { method: '${this.method}'${this.hasBody ? ', body: JSON.stringify(body)' : ''} })
    return ${this.zodName}.parse(await res.json())
  }`
  }
}
