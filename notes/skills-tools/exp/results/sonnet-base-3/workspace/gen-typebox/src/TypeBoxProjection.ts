import { type ContentSettings, type GenerateContextType, type RefName, type TypeSystemValue } from 'jsr:@skmtc/core@0.28.3'
import { createVariable } from 'jsr:@skmtc/lang-typescript@0.12.17'
import { toTypeBoxValue } from './TypeBox.ts'
import { TypeBoxBase } from './base.ts'
import type { EnrichmentSchema } from './enrichments.ts'

type ConstructorArgs = {
  context: GenerateContextType
  destinationPath: string
  refName: RefName
  settings: ContentSettings<EnrichmentSchema>
  rootRef?: RefName
}

export class TypeBoxProjection extends TypeBoxBase {
  value: TypeSystemValue

  constructor(
    { context, refName, settings, destinationPath, rootRef }: ConstructorArgs
  ) {
    super({ context, refName, settings })

    const schema = context.resolveSchemaRefOnce(refName, TypeBoxBase.id)

    this.value = toTypeBoxValue({
      schema,
      required: true,
      destinationPath,
      context,
      rootRef
    })
  }

  static schemaToValueFn = (...args: Parameters<typeof toTypeBoxValue>) => {
    return toTypeBoxValue(...args)
  }

  static createIdentifier = createVariable

  override toString() {
    return `${this.value}`
  }
}
