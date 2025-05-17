import type { OperationInsertableArgs } from '@skmtc/core'
import { QueryEndpoint } from './QueryEndpoint.ts'
import { MutationEndpoint } from './MutationEndpoint.ts'
import { TanstackQueryBase, type EnrichmentSchema } from './base.ts'

export class TanstackQuery extends TanstackQueryBase {
  client: QueryEndpoint | MutationEndpoint

  constructor({
    context,
    operation,
    settings
  }: OperationInsertableArgs<EnrichmentSchema>) {
    super({ context, operation, settings })

    this.client =
      operation.method === 'get'
        ? new QueryEndpoint({
            context,
            operation,
            settings
          })
        : new MutationEndpoint({
            context,
            operation,
            settings
          })
  }

  override toString(): string {
    return this.client.toString()
  }
}
