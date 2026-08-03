import { type GenerateContextType, type GeneratorKey } from 'jsr:@skmtc/core@0.28.3'
import { TsSnippet } from 'jsr:@skmtc/lang-typescript@0.12.17'

type ConstructorArgs = {
  context: GenerateContextType
  generatorKey: GeneratorKey
  destinationPath: string
}

export class TypeBoxVoid extends TsSnippet {
  type = 'void' as const

  constructor({ context, generatorKey, destinationPath }: ConstructorArgs) {
    super({ context, generatorKey })

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    return `Type.Void()`
  }
}
