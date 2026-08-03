import { List, type ListLines } from 'jsr:@skmtc/lang-typescript@0.12.17'
import type { OasOperation, OasOperationProjectionConstructorArgs } from 'jsr:@skmtc/core@0.28.3'
import { ClientClassBase } from './base.ts'
import { ClientMethod } from './ClientMethod.ts'
import type { EnrichmentSchema } from './enrichments.ts'

export class ClientClass extends ClientClassBase {
  methods: ListLines<ClientMethod>

  constructor(args: OasOperationProjectionConstructorArgs<EnrichmentSchema>) {
    super(args)
    this.methods = List.toLines([])
  }

  append(operation: OasOperation) {
    this.methods.values.push(
      new ClientMethod({
        context: this.context,
        operation,
        destinationPath: this.settings.exportPath
      })
    )
  }

  override toString(): string {
    return `export class ${this.settings.identifier.name} {
${this.methods}
}`
  }
}
