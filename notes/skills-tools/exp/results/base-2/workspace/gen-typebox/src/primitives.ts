import type {
  GenerateContextType,
  GeneratorKey,
  Modifiers,
  OasBoolean,
  OasInteger,
  OasNumber,
  OasRef,
  OasSchema,
  OasString
} from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import { applyModifiers } from './applyModifiers.ts'

const TYPEBOX_IMPORT = { '@sinclair/typebox': ['Type'] }

const toLiteral = (value: string | number | boolean | null): string => {
  return value === null ? 'Type.Null()' : `Type.Literal(${JSON.stringify(value)})`
}

/**
 * Render an enum constraint as literals: a single value becomes
 * `Type.Literal(...)`, multiple values a `Type.Union([...])`.
 */
const toEnumContent = (enums: (string | number | boolean | null)[]): string => {
  const literals = enums.map(toLiteral)

  return literals.length === 1 ? literals[0] : `Type.Union([${literals.join(', ')}])`
}

type TypeboxStringArgs = {
  context: GenerateContextType
  stringSchema: OasString
  modifiers: Modifiers
  destinationPath: string
  generatorKey: GeneratorKey
}

export class TypeboxString extends TsSnippet {
  type = 'string' as const
  enums: string[] | (string | null)[] | undefined
  modifiers: Modifiers

  constructor({ context, stringSchema, generatorKey, destinationPath, modifiers }: TypeboxStringArgs) {
    super({ context, generatorKey, stackTrail: stringSchema.stackTrail.clone() })

    this.enums = stringSchema.enums
    this.modifiers = modifiers

    this.register({ imports: TYPEBOX_IMPORT, destinationPath })
  }

  override toString(): string {
    const content = this.enums ? toEnumContent(this.enums) : 'Type.String()'

    return applyModifiers(content, this.modifiers)
  }
}

type TypeboxNumberArgs = {
  context: GenerateContextType
  schema: OasNumber
  modifiers: Modifiers
  destinationPath: string
  generatorKey: GeneratorKey
}

export class TypeboxNumber extends TsSnippet {
  type = 'number' as const
  enums: number[] | (number | null)[] | undefined
  modifiers: Modifiers

  constructor({ context, schema, generatorKey, destinationPath, modifiers }: TypeboxNumberArgs) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.enums = schema.enums
    this.modifiers = modifiers

    this.register({ imports: TYPEBOX_IMPORT, destinationPath })
  }

  override toString(): string {
    const content = this.enums ? toEnumContent(this.enums) : 'Type.Number()'

    return applyModifiers(content, this.modifiers)
  }
}

type TypeboxIntegerArgs = {
  context: GenerateContextType
  schema: OasInteger
  modifiers: Modifiers
  destinationPath: string
  generatorKey: GeneratorKey
}

export class TypeboxInteger extends TsSnippet {
  type = 'integer' as const
  enums: number[] | (number | null)[] | undefined
  modifiers: Modifiers

  constructor({ context, schema, generatorKey, destinationPath, modifiers }: TypeboxIntegerArgs) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.enums = schema.enums
    this.modifiers = modifiers

    this.register({ imports: TYPEBOX_IMPORT, destinationPath })
  }

  override toString(): string {
    const content = this.enums ? toEnumContent(this.enums) : 'Type.Integer()'

    return applyModifiers(content, this.modifiers)
  }
}

type TypeboxBooleanArgs = {
  context: GenerateContextType
  schema: OasBoolean
  modifiers: Modifiers
  destinationPath: string
  generatorKey: GeneratorKey
}

export class TypeboxBoolean extends TsSnippet {
  type = 'boolean' as const
  enums: boolean[] | (boolean | null)[] | undefined
  modifiers: Modifiers

  constructor({ context, schema, generatorKey, destinationPath, modifiers }: TypeboxBooleanArgs) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.enums = schema.enums
    this.modifiers = modifiers

    this.register({ imports: TYPEBOX_IMPORT, destinationPath })
  }

  override toString(): string {
    const content = this.enums ? toEnumContent(this.enums) : 'Type.Boolean()'

    return applyModifiers(content, this.modifiers)
  }
}

type TypeboxUnknownArgs = {
  context: GenerateContextType
  destinationPath: string
  generatorKey: GeneratorKey
  schema?: OasSchema | OasRef<'schema'>
}

export class TypeboxUnknown extends TsSnippet {
  type = 'unknown' as const

  constructor({ context, destinationPath, generatorKey, schema }: TypeboxUnknownArgs) {
    super({ context, generatorKey, stackTrail: schema?.stackTrail.clone() })

    this.register({ imports: TYPEBOX_IMPORT, destinationPath })
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

    this.register({ imports: TYPEBOX_IMPORT, destinationPath })
  }

  override toString(): string {
    return 'Type.Void()'
  }
}
