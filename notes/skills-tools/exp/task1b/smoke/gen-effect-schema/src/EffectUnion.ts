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
import { toEffectValue } from './Effect.ts'
import { applyModifiers } from './modifiers.ts'
import { LIB, LIB_MODULE } from './lib.ts'

type EffectUnionArgs = {
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

export class EffectUnion extends TsSnippet {
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
    }: EffectUnionArgs,
  ) {
    super({ context, generatorKey, stackTrail: schema?.stackTrail.clone() })

    this.members = members.map((member) =>
      toEffectValue({
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

    // SLOT(union): effect has no dedicated discriminated-union form —
    // Schema.Union narrows on the literal field; discriminator unused.
    const content = `${LIB}.Union(${members})`

    return applyModifiers(content, this.modifiers)
  }
}
