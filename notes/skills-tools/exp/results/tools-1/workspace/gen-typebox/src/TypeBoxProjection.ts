import type { ContentSettings, GenerateContextType, RefName, TypeSystemValue } from '@skmtc/core'
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
  value: TypeSystemValue

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

    // A recursive schema renders a bare back-reference to this constant
    // (see TypeBoxRef), so the `export const` references its own
    // initializer — TS7022/TS7024. Widening the identifier to `TSchema`
    // breaks the cycle. Detected via `modelDepth`: `resolveSchemaRefOnce`
    // above set this key to 1, and every terminal back-reference bumps it
    // further, so `> 1` means a cycle was emitted into this value tree.
    if (context.modelDepth[`${TypeBoxBase.id}:${refName}`] > 1) {
      this.settings.identifier.typeName = 'TSchema'

      this.register({
        imports: { '@sinclair/typebox': [{ name: 'TSchema', type: 'type' }] }
      })
    }
  }

  static schemaToValueFn = (...args: Parameters<typeof toTypeBoxValue>) => {
    return toTypeBoxValue(...args)
  }

  static createIdentifier = createVariable

  override toString(): string {
    return `${this.value}`
  }
}
