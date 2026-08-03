import { TsSnippet } from '@skmtc/lang-typescript'
import type {
  GenerateContextType,
  GeneratorKey,
  Modifiers,
  OasDiscriminator,
  OasRef,
  OasSchema,
  RefName,
  TypeSystemValue
} from '@skmtc/core'
import { toTypeboxValue } from './Typebox.ts'
import { applyModifiers } from './applyModifiers.ts'
import { typeboxImports } from './imports.ts'

type TypeboxUnionArgs = {
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

export class TypeboxUnion extends TsSnippet {
  type = 'union' as const
  members: TypeSystemValue[]
  discriminator: string | undefined
  modifiers: Modifiers

  constructor({
    context,
    generatorKey,
    destinationPath,
    members,
    discriminator,
    modifiers,
    rootRef,
    schema
  }: TypeboxUnionArgs) {
    super({ context, generatorKey, stackTrail: schema?.stackTrail.clone() })

    this.members = members.map(member =>
      toTypeboxValue({
        destinationPath,
        schema: member,
        required: true,
        context,
        rootRef
      })
    )

    // TypeBox has no discriminated-union constructor; a plain union
    // validates the same set of values, so the discriminator is dropped.
    this.discriminator = discriminator?.propertyName
    this.modifiers = modifiers

    this.register({ imports: typeboxImports, destinationPath })
  }

  override toString(): string {
    const members = this.members.map(member => `${member}`).join(', ')

    return applyModifiers(`Type.Union([${members}])`, this.modifiers)
  }
}
