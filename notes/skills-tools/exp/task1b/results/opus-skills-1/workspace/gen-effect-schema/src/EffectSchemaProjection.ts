import type {
  ContentSettings,
  GenerateContextType,
  RefName,
  TypeSystemValue,
} from '@skmtc/core'
import { createVariable } from '@skmtc/lang-typescript'
import { toEffectSchemaValue } from './EffectSchema.ts'
import { EffectSchemaBase } from './base.ts'
import type { EnrichmentSchema } from './enrichments.ts'

type ConstructorArgs = {
  context: GenerateContextType
  destinationPath: string
  refName: RefName
  settings: ContentSettings<EnrichmentSchema>
  rootRef?: RefName
}

export class EffectSchemaProjection extends EffectSchemaBase {
  value: TypeSystemValue
  /** True when this model emitted a `Schema.suspend` cycle into itself. */
  isRecursive: boolean

  constructor(
    { context, refName, settings, destinationPath, rootRef }: ConstructorArgs,
  ) {
    super({ context, refName, settings })

    const schema = context.resolveSchemaRefOnce(refName, EffectSchemaBase.id)

    this.value = toEffectSchemaValue({
      schema,
      required: true,
      destinationPath,
      context,
      rootRef,
    })

    // SLOT(recursion-annotation): deliberately empty for effect.
    //
    // A recursive schema renders a deferred back-reference (see
    // EffectSchemaRef). The enclosing `export const` then references its
    // own initializer, which TypeScript normally cannot type by
    // inference — TS7022/TS7024 — and zod-style targets fix that by
    // annotating the binding (`z.ZodType<Order>`) from a peer type
    // generator.
    //
    // effect places the same annotation one level lower: the thunk
    // passed to `Schema.suspend` carries an explicit
    // `(): Schema.Schema<any>` return type, so inference already stops
    // at the suspend boundary and never re-enters the binding. Adding a
    // binding annotation here would be redundant, and — with no peer
    // generator to supply a decoded interface — would flatten every
    // recursive model's inferred fields to `any` at the use site.
    //
    // Detection is kept live so the seam stays honest: `modelDepth` is
    // set to 1 by `resolveSchemaRefOnce` above and bumped by every
    // terminal back-reference, so `> 1` means a cycle was emitted into
    // this model's value. Self-recursion is what OpenAPI schemas
    // produce; mutual recursion is NOT detected by this check, and would
    // need a binding annotation here.
    this.isRecursive = context.modelDepth[`${EffectSchemaBase.id}:${refName}`] >
      1
  }

  // These two statics make the projection consumable by PEER generators
  // via insertNormalizedModel — keep them.
  static schemaToValueFn = (...args: Parameters<typeof toEffectSchemaValue>) => {
    return toEffectSchemaValue(...args)
  }

  static createIdentifier = createVariable

  override toString(): string {
    return `${this.value}`
  }
}
