import type { GeneratorContext, OasOperation } from 'jsr:@skmtc/core@0.28.3'
import { TsSnippet } from 'jsr:@skmtc/lang-typescript@0.12.17'
import { capitalize, OasVoid } from 'jsr:@skmtc/core@0.28.3'
import { ZodProjection } from 'jsr:@skmtc/gen-zod@0.2.5'

interface ClientMethodConstructorArgs {
  context: GeneratorContext
  operation: OasOperation
  destinationPath: string
}

export class ClientMethod extends TsSnippet {
  operation: OasOperation
  methodName: string
  zodResponseName: string
  pathParams: string[]
  hasBody: boolean

  constructor({ context, operation, destinationPath }: ClientMethodConstructorArgs) {
    super({ context })
    this.operation = operation

    this.methodName = buildMethodName(operation)
    this.pathParams = operation.toParams(['path']).map(p => p.name)
    this.hasBody = !!operation.requestBody && ['post', 'put', 'patch'].includes(operation.method.toLowerCase())

    const zodResponse = this.context.insertNormalizedModel(ZodProjection, {
      schema: operation.toSuccessResponse()?.resolve().toSchema() ?? OasVoid.empty(),
      fallbackName: `${capitalize(this.methodName)}Response`
    })
    this.zodResponseName = zodResponse.identifier.name

    this.register({
      imports: {
        zod: ['z']
      }
    })
  }

  override toString(): string {
    const path = this.operation.path.replace(/{([^}]+)}/g, '${\\$$1}')
    const params = this.pathParams.length > 0 ? this.pathParams.map(p => `${p}: string`).join(', ') : ''
    const methodSig = `async ${this.methodName}(${params}${this.hasBody ? (params ? ', ' : '') + 'body: unknown' : ''})`

    const fetchCall = `const res = await fetch(\`${path}\`, {
      method: '${this.operation.method.toUpperCase()}',${this.hasBody ? '\n      body: JSON.stringify(body),' : ''}
      headers: { 'Content-Type': 'application/json' }
    })`

    return `
  ${methodSig} {
    ${fetchCall}
    if (!res.ok) throw new Error(await res.text())
    return ${this.zodResponseName}.parse(await res.json())
  }`
  }
}

function buildMethodName(operation: OasOperation): string {
  const method = operation.method.toLowerCase()
  const pathParts = operation.path
    .split('/')
    .filter(Boolean)
    .map(p => capitalize(p.replace(/{|}/g, '')))
  return method + pathParts.join('')
}
