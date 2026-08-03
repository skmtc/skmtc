import type { GenerateContextType, GeneratorKey } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'

// `OasVoid` is not part of the `OasSchema` union, so it can't flow through
// `SnippetBase.schema`. A void snippet inherits its ancestor / key-derived
// pointer — there's no schema-value location to capture.
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
