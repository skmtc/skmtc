import { createVariable } from '@skmtc/lang-typescript'
import type { ModelProjectionConstructorArgs, Stringable } from '@skmtc/core'
import { TypeboxBase } from './base.ts'
import { toTypeboxValue } from './toTypeboxValue.ts'
import type { EnrichmentSchema } from './enrichments.ts'

export class TypeboxProjection extends TypeboxBase {
  value: Stringable

  constructor({ context, refName, settings }: ModelProjectionConstructorArgs<EnrichmentSchema>) {
    super({ context, refName, settings })

    const schema = context.resolveSchemaRefOnce(refName, TypeboxBase.id)

    this.value = toTypeboxValue({
      schema,
      destinationPath: settings.exportPath,
      context,
      generatorKey: this.generatorKey
    })
  }

  static createIdentifier = createVariable

  override toString(): string {
    return `${this.value}`
  }
}
