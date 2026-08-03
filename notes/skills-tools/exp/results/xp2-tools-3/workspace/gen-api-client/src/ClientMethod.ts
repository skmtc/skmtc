import { OasVoid, camelCase } from '@skmtc/core'
import type { GenerateContextType, GeneratorKey, OasOperation } from '@skmtc/core'
import { List, TsSnippet, toPathTemplate } from '@skmtc/lang-typescript'
import type { ListParams } from '@skmtc/lang-typescript'
import { insertZodModel } from './insertZodModel.ts'

type ConstructorArgs = {
  context: GenerateContextType
  operation: OasOperation
  destinationPath: string
  generatorKey: GeneratorKey
}

/** Deterministic method name from method + path: `GET /orders/{id}` → `getOrdersId`. */
export const toMethodName = (operation: OasOperation): string => {
  return `${operation.method}${camelCase(operation.path, { upperFirst: true })}`
}

export class ClientMethod extends TsSnippet {
  operation: OasOperation
  name: string
  responseName: string
  requestBodyName: string | undefined
  parameters: ListParams<string>
  fetchOptions: List<string[], ',\n      ', 'none'>

  constructor({ context, operation, destinationPath, generatorKey }: ConstructorArgs) {
    super({ context, generatorKey })

    this.operation = operation
    this.name = toMethodName(operation)

    this.responseName = insertZodModel({
      context,
      schema: operation.toSuccessResponse()?.resolve().toSchema() ?? OasVoid.empty(),
      fallbackName: `${this.name}Response`,
      destinationPath
    })

    this.requestBodyName = operation.toRequestBody(({ schema }) =>
      insertZodModel({
        context,
        schema,
        fallbackName: `${this.name}Request`,
        destinationPath
      })
    )

    if (this.requestBodyName) {
      this.register({ imports: { zod: ['z'] }, destinationPath })
    }

    this.parameters = List.toParams([
      ...operation.toParams(['path']).map(({ name }) => `${name}: string`),
      ...(this.requestBodyName ? [`body: z.infer<typeof ${this.requestBodyName}>`] : [])
    ])

    this.fetchOptions = new List<string[], ',\n      ', 'none'>(
      [
        `method: '${operation.method.toUpperCase()}'`,
        ...(this.requestBodyName
          ? [`headers: { 'Content-Type': 'application/json' }`, `body: JSON.stringify(body)`]
          : [])
      ],
      { separator: ',\n      ' }
    )
  }

  override toString(): string {
    return `async ${this.name}${this.parameters} {
    const res = await fetch(\`${toPathTemplate(this.operation.path)}\`, {
      ${this.fetchOptions}
    })

    if (!res.ok) {
      throw new Error(await res.text())
    }

    return ${this.responseName}.parse(await res.json())
  }`
  }
}
