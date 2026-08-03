import { OasVoid } from '@skmtc/core'
import type { OasOperation, OasOperationProjectionConstructorArgs } from '@skmtc/core'
import { toPathTemplate } from '@skmtc/lang-typescript'
import { ZodProjection } from '@skmtc/gen-zod'
import { ApiClientBase } from './base.ts'
import type { EnrichmentSchema } from './enrichments.ts'
import { toMethodName } from './naming.ts'

type ClientMethod = {
  name: string
  httpMethod: string
  path: string
  pathParams: string[]
  hasBody: boolean
  responseName: string
}

export class ApiClient extends ApiClientBase {
  clientMethods: ClientMethod[]

  constructor({ context, operation, settings }: OasOperationProjectionConstructorArgs<EnrichmentSchema>) {
    super({ context, operation, settings })

    this.clientMethods = []
  }

  append(operation: OasOperation) {
    const name = toMethodName(operation)

    const zodResponse = this.insertNormalizedModel(ZodProjection, {
      schema: operation.toSuccessResponse()?.resolve().toSchema() ?? OasVoid.empty(),
      fallbackName: `${name}Response`
    })

    this.clientMethods.push({
      name,
      httpMethod: operation.method.toUpperCase(),
      path: operation.path,
      pathParams: operation.toParams(['path']).map(param => param.name),
      hasBody: operation.method === 'post' || operation.method === 'put' || operation.method === 'patch',
      responseName: zodResponse.identifier.name
    })
  }

  override toString(): string {
    const methods = this.clientMethods
      .map(({ name, httpMethod, path, pathParams, hasBody, responseName }) => {
        const params = pathParams.map(param => `${param}: string`)

        if (hasBody) {
          params.push('body: unknown')
        }

        const requestInit = hasBody
          ? `{
      method: '${httpMethod}',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }`
          : `{ method: '${httpMethod}' }`

        return `  async ${name}(${params.join(', ')}) {
    const res = await fetch(\`${toPathTemplate(path)}\`, ${requestInit})

    if (!res.ok) {
      throw new Error(await res.text())
    }

    return ${responseName}.parse(await res.json())
  }`
      })
      .join('\n\n')

    return `{
${methods}
}`
  }
}
