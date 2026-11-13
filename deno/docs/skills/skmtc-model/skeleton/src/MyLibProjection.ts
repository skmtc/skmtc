import { camelCase, capitalize, isReferencedBack } from '@skmtc/core'
import type {
  ContentSettings,
  GenerateContextType,
  RefName,
  TypeSystemValue,
} from '@skmtc/core'
import { createVariable } from '@skmtc/lang-typescript'
import { toMyLibValue } from './MyLib.ts'
import { MyLibBase } from './base.ts'
import type { EnrichmentSchema } from './enrichments.ts'

type ConstructorArgs = {
  context: GenerateContextType
  destinationPath: string
  refName: RefName
  settings: ContentSettings<EnrichmentSchema>
  rootRef?: RefName
}

export class MyLibProjection extends MyLibBase {
  value: TypeSystemValue

  constructor(
    { context, refName, settings, destinationPath, rootRef }: ConstructorArgs,
  ) {
    super({ context, refName, settings })

    const schema = context.resolveSchemaRefOnce(refName)

    this.value = toMyLibValue({
      schema,
      required: true,
      destinationPath,
      context,
      rootRef,
    })

    // A recursive schema renders a lazy back-reference (see MyLibRef).
    // The enclosing `export const` then references its own initializer,
    // which TypeScript cannot type by inference — TS7022/TS7024.
    // `isReferencedBack` asks the model's pending entry, which counts each
    // reference back to it while this constructor runs, on its own or in a
    // cycle of several models. (Rendering here instead would orphan every
    // inner snippet from the attribution map.)
    if (isReferencedBack({ context, settings })) {
      // SLOT(recursion-annotation): a type expression that breaks the
      // cycle, valid in the emitted file (zod: `z.ZodType<Order>`, with
      // the type supplied by a peer type generator).
      this.settings.identifier.typeName = `MyLibSchema<${
        capitalize(camelCase(refName))
      }>`
    }
  }

  // These two statics make the projection consumable by PEER generators
  // via insertNormalizedModel — keep them.
  static schemaToValueFn = (...args: Parameters<typeof toMyLibValue>) => {
    return toMyLibValue(...args)
  }

  static createIdentifier = createVariable

  override toString(): string {
    return `${this.value}`
  }
}
