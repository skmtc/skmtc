import { TsSnippet } from '@skmtc/lang-typescript'
import type {
  GenerateContextType,
  GeneratorKey,
  Modifiers,
  OasString,
  StackTrail
} from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'
import { EFFECT_MODULE, SCHEMA } from './constants.ts'

type ScalarArgs = {
  context: GenerateContextType
  destinationPath: string
  modifiers: Modifiers
  generatorKey: GeneratorKey
  /** Position of the originating schema node — attribution input only. */
  stackTrail?: StackTrail
}

type EffectScalarArgs = ScalarArgs & {
  /** The bare effect Schema expression this snippet renders. */
  expression: string
}

/**
 * Shared base for the leaf snippets: each holds one effect Schema
 * expression, registers the `import { Schema } from 'effect'` that
 * expression depends on, and renders itself wrapped in its modifiers.
 */
class EffectScalar extends TsSnippet {
  expression: string
  modifiers: Modifiers

  constructor({
    context,
    destinationPath,
    modifiers,
    generatorKey,
    stackTrail,
    expression
  }: EffectScalarArgs) {
    super({ context, generatorKey, stackTrail })

    this.expression = expression
    this.modifiers = modifiers

    this.register({ imports: { [EFFECT_MODULE]: [SCHEMA] }, destinationPath })
  }

  override toString(): string {
    return applyModifiers(this.expression, this.modifiers)
  }
}

/**
 * A string schema carrying an `enum` becomes the literal union of its
 * values; otherwise it is effect's plain `Schema.String`. A single-value
 * enum still renders `Schema.Literal(…)`, which is effect's exact-value
 * schema.
 */
const toStringExpression = ({ enums }: OasString): string => {
  if (!Array.isArray(enums) || enums.length === 0) {
    return `${SCHEMA}.String`
  }

  const literals = enums
    .map(value => (value === null ? 'null' : `'${value.replaceAll("'", "\\'")}'`))
    .join(', ')

  return `${SCHEMA}.Literal(${literals})`
}

type EffectStringArgs = ScalarArgs & { stringSchema: OasString }

export class EffectString extends EffectScalar {
  type = 'string' as const

  constructor({ stringSchema, ...rest }: EffectStringArgs) {
    super({ ...rest, expression: toStringExpression(stringSchema) })
  }
}

export class EffectNumber extends EffectScalar {
  type = 'number' as const

  constructor(args: ScalarArgs) {
    super({ ...args, expression: `${SCHEMA}.Number` })
  }
}

/** `Schema.Int` is effect's `Number` narrowed by the `int` refinement. */
export class EffectInteger extends EffectScalar {
  type = 'integer' as const

  constructor(args: ScalarArgs) {
    super({ ...args, expression: `${SCHEMA}.Int` })
  }
}

export class EffectBoolean extends EffectScalar {
  type = 'boolean' as const

  constructor(args: ScalarArgs) {
    super({ ...args, expression: `${SCHEMA}.Boolean` })
  }
}

export class EffectUnknown extends EffectScalar {
  type = 'unknown' as const

  constructor(args: ScalarArgs) {
    super({ ...args, expression: `${SCHEMA}.Unknown` })
  }
}

export class EffectVoid extends EffectScalar {
  type = 'void' as const

  constructor(args: ScalarArgs) {
    super({ ...args, expression: `${SCHEMA}.Void` })
  }
}
