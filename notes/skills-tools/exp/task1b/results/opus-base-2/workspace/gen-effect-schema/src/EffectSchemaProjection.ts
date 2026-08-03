import type {
  ContentSettings,
  GenerateContextType,
  RefName,
  TypeSystemValue
} from '@skmtc/core'
import { createVariable } from '@skmtc/lang-typescript'
import { toEffectValue } from './Effect.ts'
import { EffectSchemaBase } from './base.ts'
import { RECURSIVE_TYPE_NAME } from './constants.ts'
import type { EnrichmentSchema } from './enrichments.ts'

type ConstructorArgs = {
  context: GenerateContextType
  destinationPath: string
  refName: RefName
  settings: ContentSettings<EnrichmentSchema>
  rootRef?: RefName
}

/**
 * One model → one `export const <Name> = Schema…` in
 * `@/models/<Name>.generated.ts`.
 */
export class EffectSchemaProjection extends EffectSchemaBase {
  value: TypeSystemValue

  constructor({ context, refName, settings, destinationPath, rootRef }: ConstructorArgs) {
    super({ context, refName, settings })

    const schema = context.resolveSchemaRefOnce(refName, EffectSchemaBase.id)

    this.value = toEffectValue({
      context,
      destinationPath,
      schema,
      required: true,
      rootRef
    })

    // A self-recursive model renders a `Schema.suspend(() => self)`
    // back-reference (see EffectRef), so its `export const` references its
    // own initializer — which TypeScript cannot type by inference (TS7022 /
    // TS7024). Annotating the identifier makes the Definition emit
    // `export const X: Schema.Schema<any> = …`, breaking the cycle.
    //
    // Detected via `modelDepth` rather than by rendering: the
    // `resolveSchemaRefOnce` above set this key to 1, and every terminal
    // back-reference bumps it further, so `> 1` means a cycle was emitted
    // into this model's value. (Reading the rendered string here would
    // pre-render the value tree outside the attribution pass.)
    if (context.modelDepth[`${EffectSchemaBase.id}:${refName}`] > 1) {
      this.settings.identifier.typeName = RECURSIVE_TYPE_NAME
    }
  }

  static schemaToValueFn = (...args: Parameters<typeof toEffectValue>) => toEffectValue(...args)

  static createIdentifier = createVariable

  override toString(): string {
    return `${this.value}`
  }
}
