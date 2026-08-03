import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey } from '@skmtc/core'

type ConstructorArgs = {
  context: GenerateContextType
  generatorKey: GeneratorKey
  destinationPath: string
}

export class TypeboxVoid extends TsSnippet {
  type = 'void' as const

  constructor({ context, generatorKey, destinationPath }: ConstructorArgs) {
    super({ context, generatorKey })

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    return `Type.Void()`
  }
}
