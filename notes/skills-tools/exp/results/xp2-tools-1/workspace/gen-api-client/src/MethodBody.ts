import { OasVoid, toOasOperationGeneratorKey } from '@skmtc/core'
import type { GenerateContextType, OasOperation } from '@skmtc/core'
import { TsSnippet, toPathTemplate } from '@skmtc/lang-typescript'
import { insertZodSchema } from './insertZodSchema.ts'
import { toMethodName } from './identifiers.ts'
import denoJson from '../deno.json' with { type: 'json' }

type ConstructorArgs = {
  context: GenerateContextType
  operation: OasOperation
  destinationPath: string
}

export class MethodBody extends TsSnippet {
  operation: OasOperation
  responseName: string
  bodyName: string | undefined

  constructor({ context, operation, destinationPath }: ConstructorArgs) {
    super({
      context,
      generatorKey: toOasOperationGeneratorKey({ generatorId: denoJson.name, operation })
    })

    this.operation = operation

    const methodName = toMethodName(operation)

    this.responseName = insertZodSchema({
      context,
      schema: operation.toSuccessResponse()?.resolve().toSchema() ?? OasVoid.empty(),
      fallbackName: `${methodName}Response`,
      destinationPath
    })

    const bodySchema = operation.toRequestBody(({ schema }) => schema)

    if (bodySchema) {
      this.bodyName = insertZodSchema({
        context,
        schema: bodySchema,
        fallbackName: `${methodName}Body`,
        destinationPath
      })
    }
  }

  override toString(): string {
    const { path, method } = this.operation

    const bodyArg =
      this.bodyName === undefined
        ? ''
        : `,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)`

    return `
    const res = await fetch(\`${toPathTemplate(path)}\`, {
      method: '${method.toUpperCase()}'${bodyArg}
    })

    if (!res.ok) {
      throw new Error(await res.text())
    }

    return ${this.responseName}.parse(await res.json())
  `
  }
}
