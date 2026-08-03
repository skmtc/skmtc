import type { GenerateContextType, GeneratorKey, Modifiers, OasArray, Stringable } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import { applyModifiers } from './applyModifiers.ts'
import { toTypeboxValue } from './toTypeboxValue.ts'

type TypeboxArrayArgs = {
  context: GenerateContextType
  arraySchema: OasArray
  required: boolean
  destinationPath: string
  generatorKey?: GeneratorKey
}

export class TypeboxArray extends TsSnippet {
  items: Stringable
  modifiers: Modifiers

  constructor({ context, arraySchema, required, destinationPath, generatorKey }: TypeboxArrayArgs) {
    super({ context, generatorKey })

    this.modifiers = { required, nullable: arraySchema.nullable }

    this.items = toTypeboxValue({
      schema: arraySchema.items,
      required: true,
      destinationPath,
      context,
      generatorKey
    })

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    return applyModifiers(`Type.Array(${this.items})`, this.modifiers)
  }
}
