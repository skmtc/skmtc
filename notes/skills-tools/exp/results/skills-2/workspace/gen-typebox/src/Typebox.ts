import type { ModelProjectionConstructorArgs, Stringable } from '@skmtc/core'
import { createVariable } from '@skmtc/lang-typescript'
import { TypeboxBase } from './base.ts'
import type { TypeboxEnrichments } from './enrichments.ts'
import { toTypeboxValue } from './toTypeboxValue.ts'

export class TypeboxProjection extends TypeboxBase {
  value: Stringable

  constructor({
    context,
    refName,
    settings,
    destinationPath
  }: ModelProjectionConstructorArgs<TypeboxEnrichments>) {
    super({ context, refName, settings })

    const schema = context.resolveSchemaRefOnce(refName, TypeboxBase.id)

    this.value = toTypeboxValue({
      schema,
      required: true,
      destinationPath,
      context,
      generatorKey: this.generatorKey
    })
  }

  static schemaToValueFn = (...args: Parameters<typeof toTypeboxValue>): Stringable =>
    toTypeboxValue(...args)

  static createIdentifier = createVariable

  override toString(): string {
    return `${this.value}`
  }
}
