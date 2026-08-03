import { List, type ListLines } from '@skmtc/lang-typescript'
import { OasVoid } from '@skmtc/core'
import type { OasOperation, OasOperationProjectionConstructorArgs } from '@skmtc/core'
import { ZodProjection } from '@skmtc/gen-zod'
import { ApiClientBase } from './base.ts'
import { ClientMethod } from './ClientMethod.ts'
import { toMethodName } from './names.ts'
import type { EnrichmentSchema } from './enrichments.ts'

export class ApiClient extends ApiClientBase {
  methods: ListLines<ClientMethod>

  constructor({ context, operation, settings }: OasOperationProjectionConstructorArgs<EnrichmentSchema>) {
    super({ context, operation, settings })

    this.methods = List.toLines([])
  }

  append(operation: OasOperation) {
    const methodName = toMethodName(operation)

    const zodResponse = this.insertNormalizedModel(ZodProjection, {
      schema: operation.toSuccessResponse()?.resolve().toSchema() ?? OasVoid.empty(),
      fallbackName: `${methodName}Response`
    })

    this.methods.values.push(
      new ClientMethod({
        operation,
        methodName,
        zodResponseName: zodResponse.identifier.name
      })
    )
  }

  override toString(): string {
    return `{
${this.methods}
}`
  }
}
