import type { GenerateContextType, GeneratorKey, Modifiers } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import { applyModifiers } from './applyModifiers.ts'

export type ScalarKind = 'number' | 'integer' | 'boolean' | 'unknown'

const scalarCalls: Record<ScalarKind, string> = {
  number: 'Type.Number()',
  integer: 'Type.Integer()',
  boolean: 'Type.Boolean()',
  unknown: 'Type.Unknown()'
}

type TypeboxScalarArgs = {
  context: GenerateContextType
  kind: ScalarKind
  modifiers: Modifiers
  destinationPath: string
  generatorKey?: GeneratorKey
}

export class TypeboxScalar extends TsSnippet {
  kind: ScalarKind
  modifiers: Modifiers

  constructor({ context, kind, modifiers, destinationPath, generatorKey }: TypeboxScalarArgs) {
    super({ context, generatorKey })

    this.kind = kind
    this.modifiers = modifiers

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    return applyModifiers(scalarCalls[this.kind], this.modifiers)
  }
}
