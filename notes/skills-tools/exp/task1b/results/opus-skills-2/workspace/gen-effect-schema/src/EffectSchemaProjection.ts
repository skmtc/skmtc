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
    // A recursive schema renders a lazy back-reference (see
    // EffectSchemaRef) and the enclosing `export const` then references
    // its own initializer — normally untypeable by inference
    // (TS7022/TS7024), which is what an identifier annotation exists to
    // break. effect breaks the cycle one level lower instead: the
    // `Schema.suspend((): Schema.Schema<any> => …)` thunk carries an
    // explicit return type, so TypeScript never descends into the
    // self-reference to type the binding, and `deno check` passes on the
    // emitted file with no annotation at all.
    //
    // Annotating anyway would be worse: without a peer type generator
    // supplying the model's TS type, the only annotation available is
    // `Schema.Schema<any>`, which would erase the struct type that
    // consumers of the emitted schema read off it. So the binding stays
    // inferred, and `context.modelDepth` needs no consultation here.
  }

  // These two statics make the projection consumable by PEER generators
  // via insertNormalizedModel — keep them.
  static schemaToValueFn = (
    ...args: Parameters<typeof toEffectSchemaValue>
  ) => {
    return toEffectSchemaValue(...args)
  }

  static createIdentifier = createVariable

  override toString(): string {
    return `${this.value}`
  }
}
