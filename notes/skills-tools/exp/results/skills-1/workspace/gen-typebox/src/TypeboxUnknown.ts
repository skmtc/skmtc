import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, OasRef, OasSchema } from '@skmtc/core'

type ConstructorArgs = {
  context: GenerateContextType
  destinationPath: string
  generatorKey: GeneratorKey
  schema?: OasSchema | OasRef<'schema'>
}

export class TypeboxUnknown extends TsSnippet {
  type = 'unknown' as const

  constructor({ context, destinationPath, generatorKey, schema }: ConstructorArgs) {
    super({ context, generatorKey, stackTrail: schema?.stackTrail.clone() })

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    return `Type.Unknown()`
  }
}
