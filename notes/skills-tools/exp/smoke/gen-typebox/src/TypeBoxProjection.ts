import type {
  ContentSettings,
  GenerateContextType,
  RefName,
  Stringable
} from '@skmtc/core'
import { createVariable } from '@skmtc/lang-typescript'
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
  value: Stringable

  constructor({ context, refName, settings, destinationPath, rootRef }: ConstructorArgs) {
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

  override toString(): string {
    return `${this.value}`
  }
}
