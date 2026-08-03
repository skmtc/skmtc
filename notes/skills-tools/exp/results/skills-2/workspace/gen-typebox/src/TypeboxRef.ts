import type { GenerateContextType, GeneratorKey, Modifiers, OasRef } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import { applyModifiers } from './applyModifiers.ts'
import { TypeboxProjection } from './Typebox.ts'

type TypeboxRefArgs = {
  context: GenerateContextType
  ref: OasRef<'schema'>
  required: boolean
  destinationPath: string
  generatorKey?: GeneratorKey
}

export class TypeboxRef extends TsSnippet {
  name: string
  modifiers: Modifiers

  constructor({ context, ref, required, destinationPath, generatorKey }: TypeboxRefArgs) {
    super({ context, generatorKey })

    this.modifiers = { required }

    const inserted = context.insertModel(TypeboxProjection, ref.toRefName(), { destinationPath })

    this.name = inserted.toName()

    if (!required) {
      this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
    }
  }

  override toString(): string {
    return applyModifiers(this.name, this.modifiers)
  }
}
