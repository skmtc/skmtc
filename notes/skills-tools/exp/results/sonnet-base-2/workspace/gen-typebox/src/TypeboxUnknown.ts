import { type GenerateContextType, type GeneratorKey, type OasRef, type OasSchema } from 'jsr:@skmtc/core@0.28.3'
import { TsSnippet } from 'jsr:@skmtc/lang-typescript@0.12.17'

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
