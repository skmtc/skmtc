import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, Modifiers, OasDiscriminator, OasRef, OasSchema, RefName, TypeSystemValue } from '@skmtc/core'
import { toTypeBoxValue } from './TypeBox.ts'
import { applyModifiers } from './applyModifiers.ts'

type TypeBoxUnionArgs = {
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

export class TypeBoxUnion extends TsSnippet {
  type = 'union' as const
  members: TypeSystemValue[]
  discriminator: string | undefined
  modifiers: Modifiers

  constructor({ context, generatorKey, destinationPath, members, discriminator, modifiers, rootRef, schema }: TypeBoxUnionArgs) {
    super({ context, generatorKey, stackTrail: schema?.stackTrail.clone() })

    this.members = members.map(member => {
      return toTypeBoxValue({
        destinationPath,
        schema: member,
        required: true,
        context,
        rootRef
      })
    })

    // TypeBox has no dedicated discriminated-union constructor — a plain
    // Type.Union validates the same set; the discriminator is kept only as
    // structured metadata.
    this.discriminator = discriminator?.propertyName

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })

    this.modifiers = modifiers
  }

  override toString(): string {
    const members = this.members.map(member => `${member}`).join(', ')

    return applyModifiers(`Type.Union([${members}])`, this.modifiers)
  }
}
