import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, Modifiers, OasInteger, OasNumber } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'
import { typeboxImports } from './imports.ts'

/**
 * Shared numeric-constraint rendering for number and integer schemas.
 * OAS 3.0 models exclusivity as booleans qualifying `minimum` / `maximum`;
 * TypeBox (JSON Schema 2020-12) takes numeric `exclusiveMinimum` /
 * `exclusiveMaximum`, so the bound value migrates between keys.
 */
const toNumericOptions = (schema: OasNumber | OasInteger): string[] => {
  const options: string[] = []

  if (schema.minimum !== undefined) {
    options.push(
      schema.exclusiveMinimum ? `exclusiveMinimum: ${schema.minimum}` : `minimum: ${schema.minimum}`
    )
  }

  if (schema.maximum !== undefined) {
    options.push(
      schema.exclusiveMaximum ? `exclusiveMaximum: ${schema.maximum}` : `maximum: ${schema.maximum}`
    )
  }

  if (schema.multipleOf !== undefined) {
    options.push(`multipleOf: ${schema.multipleOf}`)
  }

  return options
}

const toNumericContent = (
  base: 'Type.Number' | 'Type.Integer',
  enums: number[] | (number | null)[] | undefined,
  options: string[]
): string => {
  if (enums && Array.isArray(enums)) {
    const literals = enums.map(value => (value === null ? 'Type.Null()' : `Type.Literal(${value})`))

    return literals.length === 1 ? literals[0] : `Type.Union([${literals.join(', ')}])`
  }

  return options.length ? `${base}({ ${options.join(', ')} })` : `${base}()`
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
  modifiers: Modifiers
  enums?: number[] | (number | null)[]
  options: string[]

  constructor({ context, schema, modifiers, destinationPath, generatorKey }: TypeboxNumberArgs) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.modifiers = modifiers
    this.enums = schema.enums
    this.options = toNumericOptions(schema)

    this.register({ imports: typeboxImports, destinationPath })
  }

  override toString(): string {
    return applyModifiers(toNumericContent('Type.Number', this.enums, this.options), this.modifiers)
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
  modifiers: Modifiers
  enums?: number[] | (number | null)[]
  options: string[]

  constructor({ context, schema, modifiers, destinationPath, generatorKey }: TypeboxIntegerArgs) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.modifiers = modifiers
    this.enums = schema.enums
    this.options = toNumericOptions(schema)

    this.register({ imports: typeboxImports, destinationPath })
  }

  override toString(): string {
    return applyModifiers(toNumericContent('Type.Integer', this.enums, this.options), this.modifiers)
  }
}
