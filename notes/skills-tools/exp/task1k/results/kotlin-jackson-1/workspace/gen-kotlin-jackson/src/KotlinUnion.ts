import { KtSnippet } from '@skmtc/lang-kotlin'
import type {
  GenerateContextType,
  GeneratorKey,
  Modifiers,
  OasDiscriminator,
  OasRef,
  OasSchema,
  RefName,
  TypeSystemValue,
} from '@skmtc/core'
import { toKotlinValue } from './Kotlin.ts'
import { applyModifiers } from './modifiers.ts'

type KotlinUnionArgs = {
  context: GenerateContextType
  destinationPath: string
  members: (OasSchema | OasRef<'schema'>)[]
  /** The originating union schema node — for fine-grained attribution. */
  schema?: OasSchema | OasRef<'schema'>
  discriminator?: OasDiscriminator
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef?: RefName
}

export class KotlinUnion extends KtSnippet {
  type = 'union' as const
  members: TypeSystemValue[]
  discriminator: string | undefined
  modifiers: Modifiers

  constructor(
    {
      context,
      generatorKey,
      destinationPath,
      members,
      discriminator,
      modifiers,
      rootRef,
      schema,
    }: KotlinUnionArgs,
  ) {
    super({ context, generatorKey, stackTrail: schema?.stackTrail.clone() })

    // The members are still walked so that every `$ref` inside a union
    // gets its own model generated and cached, even though the union's
    // own type expression cannot name them.
    this.members = members.map((member) =>
      toKotlinValue({
        destinationPath,
        schema: member,
        required: true,
        context,
        rootRef,
      })
    )

    this.discriminator = discriminator?.propertyName
    this.modifiers = modifiers
  }

  override toString(): string {
    // SLOT(union): Kotlin has no anonymous union type. Modelling `oneOf`
    // properly means a named `sealed interface` plus a Jackson
    // `@JsonTypeInfo`/`@JsonSubTypes` pair — a declaration, which only a
    // top-level model can carry. As an inline PROPERTY type the honest
    // answer is `Any`, and Jackson binds it to a LinkedHashMap.
    return applyModifiers('Any', this.modifiers)
  }
}
