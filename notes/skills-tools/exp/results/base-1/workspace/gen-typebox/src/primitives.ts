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
    const { enums } = this

    let content: string

    if (enums && Array.isArray(enums)) {
      const literals = enums.map(value =>
        value === null ? 'Type.Null()' : `Type.Literal('${value}')`
      )

      content = literals.length === 1 ? literals[0] : `Type.Union([${literals.join(', ')}])`
    } else {
      content = 'Type.String()'
    }

    return applyModifiers(content, this.modifiers)
  }
}

type TypeboxNumericArgs<Schema> = {
  context: GenerateContextType
  schema: Schema
  modifiers: Modifiers
  destinationPath: string
  generatorKey: GeneratorKey
}

export class TypeboxInteger extends TsSnippet {
  type = 'integer' as const
  enums?: number[] | (number | null)[]
  modifiers: Modifiers

  constructor({ context, schema, modifiers, destinationPath, generatorKey }: TypeboxNumericArgs<OasInteger>) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.enums = schema.enums
    this.modifiers = modifiers

    this.register({ imports: TYPEBOX_IMPORT, destinationPath })
  }

  override toString(): string {
    return applyModifiers(numericContent(this.enums, 'Type.Integer()'), this.modifiers)
  }
}

export class TypeboxNumber extends TsSnippet {
  type = 'number' as const
  enums?: number[] | (number | null)[]
  modifiers: Modifiers

  constructor({ context, schema, modifiers, destinationPath, generatorKey }: TypeboxNumericArgs<OasNumber>) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.enums = schema.enums
    this.modifiers = modifiers

    this.register({ imports: TYPEBOX_IMPORT, destinationPath })
  }

  override toString(): string {
    return applyModifiers(numericContent(this.enums, 'Type.Number()'), this.modifiers)
  }
}

const numericContent = (enums: number[] | (number | null)[] | undefined, fallback: string): string => {
  if (enums && Array.isArray(enums)) {
    const literals = enums.map(value => (value === null ? 'Type.Null()' : `Type.Literal(${value})`))

    return literals.length === 1 ? literals[0] : `Type.Union([${literals.join(', ')}])`
  }

  return fallback
}

export class TypeboxBoolean extends TsSnippet {
  type = 'boolean' as const
  enums?: boolean[] | (boolean | null)[]
  modifiers: Modifiers

  constructor({ context, schema, modifiers, destinationPath, generatorKey }: TypeboxNumericArgs<OasBoolean>) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.enums = schema.enums
    this.modifiers = modifiers

    this.register({ imports: TYPEBOX_IMPORT, destinationPath })
  }

  override toString(): string {
    const { enums } = this

    const content =
      enums && Array.isArray(enums) && enums.length === 1 && enums[0] !== null
        ? `Type.Literal(${enums[0]})`
        : 'Type.Boolean()'

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
