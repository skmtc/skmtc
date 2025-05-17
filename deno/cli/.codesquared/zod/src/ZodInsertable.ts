import type { TypeSystemValue, GenerateContext, RefName, ContentSettings } from '@skmtc/core'
import { toZodValue } from './Zod.ts'
import { ZodBase } from './base.ts'
import type {  EnrichmentSchema } from './enrichments.ts'

type ConstructorArgs = {
  context: GenerateContext
  destinationPath: string
  refName: RefName
  settings: ContentSettings<EnrichmentSchema>
  rootRef: RefName
}

export class ZodInsertable extends ZodBase {
  value: TypeSystemValue
  constructor({ context, refName, settings, destinationPath, rootRef }: ConstructorArgs) {
    super({ context, refName, settings })

    const schema = context.resolveSchemaRefOnce(refName, ZodBase.id)

    this.value = toZodValue({
      schema,
      required: true,
      destinationPath,
      context,
      rootRef
    })
  }

  override toString() {
    return `${this.value}`
  }
}
