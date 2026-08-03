import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, OasArray, Stringable } from '@skmtc/core'
import { toTypeboxValue } from './toTypeboxValue.ts'
import { applyNullable } from './applyNullable.ts'

type ConstructorArgs = {
  context: GenerateContextType
  arraySchema: OasArray
  destinationPath: string
  generatorKey?: GeneratorKey
}

export class TypeboxArray extends TsSnippet {
  items: Stringable
  nullable: boolean | undefined

  constructor({ context, arraySchema, destinationPath, generatorKey }: ConstructorArgs) {
    super({ context, generatorKey, stackTrail: arraySchema.stackTrail.clone() })

    this.nullable = arraySchema.nullable
    this.items = toTypeboxValue({ schema: arraySchema.items, destinationPath, context, generatorKey })

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    return applyNullable(`Type.Array(${this.items})`, this.nullable)
  }
}
