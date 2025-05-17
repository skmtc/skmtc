import type { ContentSettings, TypeSystemValue, GenerateContext, RefName } from '@skmtc/core'
import { toTsValue } from './Ts.ts'
import { TypescriptBase } from './base.ts'
import type { EnrichmentSchema } from './enrichments.ts'

type ConstructorArgs = {
  context: GenerateContext
  refName: RefName
  settings: ContentSettings<EnrichmentSchema>
  rootRef: RefName
}

export class TsInsertable extends TypescriptBase {
  value: TypeSystemValue
  constructor({ context, refName, settings, rootRef }: ConstructorArgs) {
    super({ context, refName, settings })

   const schema = context.resolveSchemaRefOnce(refName, TypescriptBase.id)

    this.value = toTsValue({
      schema,
      required: true,
      destinationPath: settings.exportPath,
      context,
      rootRef
    })
  }

  override toString() {
    return `${this.value}`
  }
}
