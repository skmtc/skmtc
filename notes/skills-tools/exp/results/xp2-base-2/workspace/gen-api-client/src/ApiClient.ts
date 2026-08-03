import type { OasOperationProjectionConstructorArgs } from '@skmtc/core'
import { TsClass } from '@skmtc/lang-typescript'
import { ApiClientBase } from './base.ts'
import type { EnrichmentSchema } from './enrichments.ts'
import { ClientMethod } from './ClientMethod.ts'
import { toClientTag } from './naming.ts'

export class ApiClient extends ApiClientBase {
  tsClass: TsClass

  constructor({
    context,
    operation,
    settings
  }: OasOperationProjectionConstructorArgs<EnrichmentSchema>) {
    super({ context, operation, settings })

    this.tsClass = new TsClass()

    const tag = toClientTag(operation)

    const operations =
      context.document.type === 'oas'
        ? context.document.value.operations.filter(op => toClientTag(op) === tag)
        : []

    operations.forEach(op => {
      const clientMethod = new ClientMethod({ context, operation: op, settings })

      this.tsClass.addMethod(clientMethod.method)
    })
  }

  override toString(): string {
    return `${this.tsClass}`
  }
}
