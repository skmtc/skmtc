import { toGeneratorOnlyKey } from '@skmtc/core'
import type {
  ContentSettings,
  GeneratedValue,
  GenerateContextType,
  RefName,
} from '@skmtc/core'
import { createDataClass } from '@skmtc/lang-kotlin'
import { toKotlinValue } from './Kotlin.ts'
import { KotlinEnumEntries } from './KotlinEnumEntries.ts'
import { KotlinObjectProperties } from './KotlinObject.ts'
import { KotlinJacksonBase } from './base.ts'
import { isDataClassSchema, isEnumClassSchema } from './shape.ts'
import type { EnrichmentSchema } from './enrichments.ts'

type ConstructorArgs = {
  context: GenerateContextType
  destinationPath: string
  refName: RefName
  settings: ContentSettings<EnrichmentSchema>
  rootRef?: RefName
}

export class KotlinProjection extends KotlinJacksonBase {
  value: GeneratedValue

  constructor(
    { context, refName, settings, destinationPath, rootRef }: ConstructorArgs,
  ) {
    super({ context, refName, settings })

    const schema = context.resolveSchemaRefOnce(refName, KotlinJacksonBase.id)

    const generatorKey = toGeneratorOnlyKey({
      generatorId: KotlinJacksonBase.id,
    })

    // The declaration kinds branch on the SAME guards `toIdentifierType`
    // used to pick the head (shape.ts), so the head and the value it is
    // glued to cannot disagree. Their values render everything after the
    // head — a parameter list, an entry body — which is why they are built
    // here rather than in the router: only a top-level model has a name to
    // declare.
    if (isDataClassSchema(schema)) {
      this.value = new KotlinObjectProperties({
        context,
        generatorKey,
        destinationPath,
        properties: schema.properties ?? {},
        required: schema.required,
        rootRef,
      })
    } else if (isEnumClassSchema(schema)) {
      this.value = new KotlinEnumEntries({
        context,
        destinationPath,
        stringSchema: schema,
        generatorKey,
      })
    } else {
      // Everything else is a `typealias` over a plain type expression.
      this.value = toKotlinValue({
        schema,
        required: true,
        destinationPath,
        context,
        rootRef,
      })
    }

    // SLOT(recursion-annotation): deliberately empty. `context.modelDepth`
    // still tracks cycles (KotlinRef bumps it, and `> 1` here would mean
    // this model's value contains a back-reference to itself), but Kotlin
    // needs no annotation to break one: a class may name itself inside its
    // own body, so `Category.children: List<Category>?` compiles as
    // written. The TypeScript skeleton needs this slot only because
    // `export const` dies of circular inference (TS7022/7024).
  }

  // These two statics make the projection consumable by PEER generators
  // via insertNormalizedModel — keep them.
  static schemaToValueFn = (...args: Parameters<typeof toKotlinValue>) => {
    return toKotlinValue(...args)
  }

  static createIdentifier = createDataClass

  override toString(): string {
    return `${this.value}`
  }
}
