import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, StackTrail } from '@skmtc/core'
import { applyNullable } from './applyNullable.ts'

export type ScalarKind = 'number' | 'integer' | 'boolean' | 'unknown' | 'void'

const scalarContent: Record<ScalarKind, string> = {
  number: 'Type.Number()',
  integer: 'Type.Integer()',
  boolean: 'Type.Boolean()',
  unknown: 'Type.Unknown()',
  void: 'Type.Void()'
}

type ConstructorArgs = {
  context: GenerateContextType
  kind: ScalarKind
  stackTrail: StackTrail
  nullable: boolean | undefined
  destinationPath: string
  generatorKey?: GeneratorKey
}

export class TypeboxScalar extends TsSnippet {
  kind: ScalarKind
  nullable: boolean | undefined

  constructor({ context, kind, stackTrail, nullable, destinationPath, generatorKey }: ConstructorArgs) {
    super({ context, generatorKey, stackTrail })

    this.kind = kind
    this.nullable = nullable

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    return applyNullable(scalarContent[this.kind], this.nullable)
  }
}
