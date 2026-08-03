import { TsSnippet } from '@skmtc/lang-typescript'
import type {
  GenerateContextType,
  GeneratorKey,
  Modifiers,
  OasRef,
  OasSchema,
  RefName,
  StackTrail,
  TypeSystemValue
} from '@skmtc/core'
import { toEffectValue } from './Effect.ts'
import { applyModifiers } from './applyModifiers.ts'
import { EFFECT_MODULE, SCHEMA } from './constants.ts'

type EffectUnionArgs = {
  context: GenerateContextType
  destinationPath: string
  members: (OasSchema | OasRef<'schema'>)[]
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef?: RefName
  stackTrail?: StackTrail
}

/**
 * `Schema.Union(a, b, …)`. effect has no discriminated-union constructor —
 * a `discriminator` in the document narrows at decode time through the
 * members' own literal tag fields, so it needs no separate rendering.
 */
export class EffectUnion extends TsSnippet {
  type = 'union' as const
  members: TypeSystemValue[]
  modifiers: Modifiers

  constructor({
    context,
    destinationPath,
    members,
    modifiers,
    generatorKey,
    rootRef,
    stackTrail
  }: EffectUnionArgs) {
    super({ context, generatorKey, stackTrail })

    this.modifiers = modifiers

    this.members = members.map(member =>
      toEffectValue({ context, destinationPath, schema: member, required: true, rootRef })
    )

    this.register({ imports: { [EFFECT_MODULE]: [SCHEMA] }, destinationPath })
  }

  override toString(): string {
    const members = this.members.map(member => `${member}`).join(', ')

    return applyModifiers(`${SCHEMA}.Union(${members})`, this.modifiers)
  }
}
