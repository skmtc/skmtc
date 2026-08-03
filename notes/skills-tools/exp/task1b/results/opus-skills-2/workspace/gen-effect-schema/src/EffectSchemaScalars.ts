import { TsSnippet } from '@skmtc/lang-typescript'
import type {
  GenerateContextType,
  GeneratorKey,
  Modifiers,
  OasBoolean,
  OasInteger,
  OasNumber,
  OasRef,
  OasSchema,
} from '@skmtc/core'
import { applyModifiers } from './modifiers.ts'
import { LIB, LIB_MODULE } from './lib.ts'

type ScalarArgs<Schema> = {
  context: GenerateContextType
  schema: Schema
  modifiers: Modifiers
  destinationPath: string
  generatorKey: GeneratorKey
}

export class EffectSchemaNumber extends TsSnippet {
  type = 'number' as const
  schema: OasNumber
  modifiers: Modifiers

  constructor(
    { context, schema, modifiers, destinationPath, generatorKey }: ScalarArgs<
      OasNumber
    >,
  ) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.schema = schema
    this.modifiers = modifiers

    this.register({ imports: { [LIB_MODULE]: [LIB] }, destinationPath })
  }

  override toString(): string {
    // SLOT(number): minimum / maximum / multipleOf live on this.schema;
    // effect expresses those as `.pipe(Schema.greaterThanOrEqualTo(n))`.
    return applyModifiers(`${LIB}.Number`, this.modifiers)
  }
}

export class EffectSchemaInteger extends TsSnippet {
  type = 'integer' as const
  schema: OasInteger
  modifiers: Modifiers

  constructor(
    { context, schema, modifiers, destinationPath, generatorKey }: ScalarArgs<
      OasInteger
    >,
  ) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.schema = schema
    this.modifiers = modifiers

    this.register({ imports: { [LIB_MODULE]: [LIB] }, destinationPath })
  }

  override toString(): string {
    // SLOT(integer): effect ships `Schema.Int` — Number narrowed by an
    // integer filter — so no hand-composed constraint is needed.
    return applyModifiers(`${LIB}.Int`, this.modifiers)
  }
}

export class EffectSchemaBoolean extends TsSnippet {
  type = 'boolean' as const
  schema: OasBoolean
  modifiers: Modifiers

  constructor(
    { context, schema, modifiers, destinationPath, generatorKey }: ScalarArgs<
      OasBoolean
    >,
  ) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.schema = schema
    this.modifiers = modifiers

    this.register({ imports: { [LIB_MODULE]: [LIB] }, destinationPath })
  }

  override toString(): string {
    // SLOT(boolean)
    return applyModifiers(`${LIB}.Boolean`, this.modifiers)
  }
}

type EffectSchemaUnknownArgs = {
  context: GenerateContextType
  destinationPath: string
  generatorKey: GeneratorKey
  /**
   * The originating schema node — for fine-grained attribution.
   * Optional: also built internally (e.g. a record's unknown value)
   * with no originating node, in which case the pointer is inherited.
   */
  schema?: OasSchema | OasRef<'schema'>
}

export class EffectSchemaUnknown extends TsSnippet {
  type = 'unknown' as const

  constructor(
    { context, destinationPath, generatorKey, schema }: EffectSchemaUnknownArgs,
  ) {
    super({ context, generatorKey, stackTrail: schema?.stackTrail.clone() })

    this.register({ imports: { [LIB_MODULE]: [LIB] }, destinationPath })
  }

  override toString(): string {
    // SLOT(unknown): the never-throw fallback — untyped schemas route
    // here rather than failing the subject.
    return `${LIB}.Unknown`
  }
}

// `OasVoid` is not part of the `OasSchema` union, so it can't flow
// through `SnippetBase.schema` — a void snippet inherits its ancestor /
// key-derived pointer.
type EffectSchemaVoidArgs = {
  context: GenerateContextType
  generatorKey: GeneratorKey
  destinationPath: string
}

export class EffectSchemaVoid extends TsSnippet {
  type = 'void' as const

  constructor(
    { context, generatorKey, destinationPath }: EffectSchemaVoidArgs,
  ) {
    super({ context, generatorKey })

    this.register({ imports: { [LIB_MODULE]: [LIB] }, destinationPath })
  }

  override toString(): string {
    // SLOT(void)
    return `${LIB}.Void`
  }
}
