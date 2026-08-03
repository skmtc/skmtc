import type {
  ContentSettings,
  GenerateContextType,
  RefName,
  TypeSystemValue,
} from '@skmtc/core'
import { createVariable } from '@skmtc/lang-typescript'
import { toEffectValue } from './Effect.ts'
import { EffectBase } from './base.ts'
import type { EnrichmentSchema } from './enrichments.ts'

type ConstructorArgs = {
  context: GenerateContextType
  destinationPath: string
  refName: RefName
  settings: ContentSettings<EnrichmentSchema>
  rootRef?: RefName
}

export class EffectProjection extends EffectBase {
  value: TypeSystemValue

  constructor(
    { context, refName, settings, destinationPath, rootRef }: ConstructorArgs,
  ) {
    super({ context, refName, settings })

    const schema = context.resolveSchemaRefOnce(refName, EffectBase.id)

    this.value = toEffectValue({
      schema,
      required: true,
      destinationPath,
      context,
      rootRef,
    })

    // A recursive schema renders a lazy back-reference (see EffectRef).
    // The enclosing `export const` then references its own initializer,
    // which TypeScript cannot type by inference — TS7022/TS7024.
    // Detected via `modelDepth`, not by rendering: `resolveSchemaRefOnce`
    // above set this key to 1 and every terminal back-reference bumps it,
    // so `> 1` means a cycle was emitted into this model's value.
    // (Rendering here instead would orphan every inner snippet from the
    // attribution map.) Self-recursion is what OpenAPI schemas produce;
    // mutual recursion is NOT detected by this check.
    // SLOT(recursion-annotation): unused for effect — the explicit
    // return type on the Schema.suspend closure (EffectRef, SLOT lazy)
    // already breaks circular inference, so the identifier needs no
    // typeName. Other targets (zod) would set
    // `this.settings.identifier.typeName` here when modelDepth > 1.
  }

  // These two statics make the projection consumable by PEER generators
  // via insertNormalizedModel — keep them.
  static schemaToValueFn = (...args: Parameters<typeof toEffectValue>) => {
    return toEffectValue(...args)
  }

  static createIdentifier = createVariable

  override toString(): string {
    return `${this.value}`
  }
}
