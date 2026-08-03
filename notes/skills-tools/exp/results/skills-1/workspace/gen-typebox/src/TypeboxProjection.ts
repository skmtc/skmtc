import type { ContentSettings, GenerateContextType, RefName, TypeSystemValue } from '@skmtc/core'
import { createVariable } from '@skmtc/lang-typescript'
import { toTypeboxValue } from './Typebox.ts'
import { TypeboxBase } from './base.ts'
import type { EnrichmentSchema } from './enrichments.ts'

type ConstructorArgs = {
  context: GenerateContextType
  destinationPath: string
  refName: RefName
  settings: ContentSettings<EnrichmentSchema>
  rootRef?: RefName
}

export class TypeboxProjection extends TypeboxBase {
  value: TypeSystemValue

  constructor({ context, refName, settings, destinationPath, rootRef }: ConstructorArgs) {
    super({ context, refName, settings })

    const schema = context.resolveSchemaRefOnce(refName, TypeboxBase.id)

    this.value = toTypeboxValue({
      schema,
      required: true,
      destinationPath,
      context,
      rootRef
    })
  }

  static schemaToValueFn = (...args: Parameters<typeof toTypeboxValue>) => {
    return toTypeboxValue(...args)
  }

  static createIdentifier = createVariable

  override toString() {
    return `${this.value}`
  }
}
