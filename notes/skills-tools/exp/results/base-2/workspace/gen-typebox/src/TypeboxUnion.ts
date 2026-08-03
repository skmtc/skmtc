import type {
  GenerateContextType,
  GeneratorKey,
  Modifiers,
  OasRef,
  OasSchema,
  RefName,
  TypeSystemValue
} from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import { toTypeboxValue } from './Typebox.ts'
import { applyModifiers } from './applyModifiers.ts'

type TypeboxUnionArgs = {
  context: GenerateContextType
  destinationPath: string
  members: (OasSchema | OasRef<'schema'>)[]
  schema?: OasSchema | OasRef<'schema'>
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef?: RefName
}

export class TypeboxUnion extends TsSnippet {
  type = 'union' as const
  members: TypeSystemValue[]
  modifiers: Modifiers

  constructor({
    context,
    generatorKey,
    destinationPath,
    members,
    modifiers,
    rootRef,
    schema
  }: TypeboxUnionArgs) {
    super({ context, generatorKey, stackTrail: schema?.stackTrail.clone() })

    this.members = members.map(member => {
      return toTypeboxValue({
        destinationPath,
        schema: member,
        required: true,
        context,
        rootRef
      })
    })

    this.modifiers = modifiers

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const members = this.members.map(member => `${member}`).join(', ')

    return applyModifiers(`Type.Union([${members}])`, this.modifiers)
  }
}
