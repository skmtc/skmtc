import { toOasOperationGeneratorKey } from '@skmtc/core'
import type { GenerateContextType, OasOperation } from '@skmtc/core'
import { TsClass, TsSnippet } from '@skmtc/lang-typescript'
import denoJson from '../deno.json' with { type: 'json' }

type ConstructorArgs = {
  context: GenerateContextType
  operation: OasOperation
}

/**
 * The per-tag client container — a `TsClass` wrapped in a snippet so the
 * definition it becomes carries a generator key (definitions take their
 * key from their value). Keyed to the operation that first created the
 * tag's class; later operations for the same tag append methods through
 * the shared `clientClass` reference.
 */
export class ClientClass extends TsSnippet {
  clientClass: TsClass

  constructor({ context, operation }: ConstructorArgs) {
    super({
      context,
      generatorKey: toOasOperationGeneratorKey({ generatorId: denoJson.name, operation })
    })

    this.clientClass = new TsClass()
  }

  override toString(): string {
    return this.clientClass.toString()
  }
}
