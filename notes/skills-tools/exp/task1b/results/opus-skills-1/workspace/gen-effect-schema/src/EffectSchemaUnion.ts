import { TsSnippet } from '@skmtc/lang-typescript'
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
import { toEffectSchemaValue } from './EffectSchema.ts'
import { applyModifiers } from './modifiers.ts'
import { LIB, LIB_MODULE } from './lib.ts'

type EffectSchemaUnionArgs = {
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

export class EffectSchemaUnion extends TsSnippet {
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
    }: EffectSchemaUnionArgs,
  ) {
    super({ context, generatorKey, stackTrail: schema?.stackTrail.clone() })

    this.members = members.map((member) =>
      toEffectSchemaValue({
        destinationPath,
        schema: member,
        required: true,
        context,
        rootRef,
      })
    )

    this.discriminator = discriminator?.propertyName
    this.modifiers = modifiers

    this.register({ imports: { [LIB_MODULE]: [LIB] }, destinationPath })
  }

  override toString(): string {
    const members = this.members.map((member) => `${member}`).join(', ')

    // SLOT(union): `Schema.Union` is variadic and takes members
    // directly, not an array. effect has no separate discriminated-union
    // constructor — it narrows a plain union on literal tag members — so
    // `this.discriminator` needs no distinct form here.
    return applyModifiers(`${LIB}.Union(${members})`, this.modifiers)
  }
}
