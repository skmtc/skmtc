import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, OasRef, OasSchema } from '@skmtc/core'
import { typeboxImports } from './imports.ts'

type TypeboxUnknownArgs = {
  context: GenerateContextType
  destinationPath: string
  generatorKey: GeneratorKey
  /**
   * The originating schema node — for fine-grained attribution. Optional:
   * also built internally (e.g. a record's unconstrained value) with no
   * originating node, in which case the pointer is inherited.
   */
  schema?: OasSchema | OasRef<'schema'>
}

export class TypeboxUnknown extends TsSnippet {
  type = 'unknown' as const

  constructor({ context, destinationPath, generatorKey, schema }: TypeboxUnknownArgs) {
    super({ context, generatorKey, stackTrail: schema?.stackTrail.clone() })

    this.register({ imports: typeboxImports, destinationPath })
  }

  override toString(): string {
    return 'Type.Unknown()'
  }
}

type TypeboxVoidArgs = {
  context: GenerateContextType
  destinationPath: string
  generatorKey: GeneratorKey
}

export class TypeboxVoid extends TsSnippet {
  type = 'void' as const

  constructor({ context, destinationPath, generatorKey }: TypeboxVoidArgs) {
    super({ context, generatorKey })

    this.register({ imports: typeboxImports, destinationPath })
  }

  override toString(): string {
    return 'Type.Void()'
  }
}
