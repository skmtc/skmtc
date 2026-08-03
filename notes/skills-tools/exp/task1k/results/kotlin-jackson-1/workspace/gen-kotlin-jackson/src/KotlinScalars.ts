import { KtSnippet } from '@skmtc/lang-kotlin'
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

type ScalarArgs<Schema> = {
  context: GenerateContextType
  schema: Schema
  modifiers: Modifiers
  destinationPath: string
  generatorKey: GeneratorKey
}

// Every type these classes render lives in `kotlin.*`, which is imported
// into every file by the compiler — so, unlike the TypeScript skeleton,
// none of them registers an import.

export class KotlinNumber extends KtSnippet {
  type = 'number' as const
  schema: OasNumber
  modifiers: Modifiers

  constructor(
    { context, schema, modifiers, generatorKey }: ScalarArgs<OasNumber>,
  ) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.schema = schema
    this.modifiers = modifiers
  }

  override toString(): string {
    // SLOT(number): OpenAPI's `format` picks the JVM width.
    return applyModifiers(
      this.schema.format === 'float' ? 'Float' : 'Double',
      this.modifiers,
    )
  }
}

export class KotlinInteger extends KtSnippet {
  type = 'integer' as const
  schema: OasInteger
  modifiers: Modifiers

  constructor(
    { context, schema, modifiers, generatorKey }: ScalarArgs<OasInteger>,
  ) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.schema = schema
    this.modifiers = modifiers
  }

  override toString(): string {
    // SLOT(integer): `int64` overflows `Int`, so it widens to `Long`.
    return applyModifiers(
      this.schema.format === 'int64' ? 'Long' : 'Int',
      this.modifiers,
    )
  }
}

export class KotlinBoolean extends KtSnippet {
  type = 'boolean' as const
  schema: OasBoolean
  modifiers: Modifiers

  constructor(
    { context, schema, modifiers, generatorKey }: ScalarArgs<OasBoolean>,
  ) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.schema = schema
    this.modifiers = modifiers
  }

  override toString(): string {
    // SLOT(boolean)
    return applyModifiers('Boolean', this.modifiers)
  }
}

type KotlinUnknownArgs = {
  context: GenerateContextType
  destinationPath: string
  generatorKey: GeneratorKey
  modifiers?: Modifiers
  /**
   * The originating schema node — for fine-grained attribution.
   * Optional: also built internally (e.g. a record's unknown value) with
   * no originating node, in which case the pointer is inherited.
   */
  schema?: OasSchema | OasRef<'schema'>
}

export class KotlinUnknown extends KtSnippet {
  type = 'unknown' as const
  modifiers: Modifiers

  constructor(
    { context, generatorKey, modifiers, schema }: KotlinUnknownArgs,
  ) {
    super({ context, generatorKey, stackTrail: schema?.stackTrail.clone() })

    this.modifiers = modifiers ?? { required: true }
  }

  override toString(): string {
    // SLOT(unknown): the never-throw fallback — untyped schemas route
    // here rather than failing the subject. An unknown JSON value may
    // legitimately be null, so `Any?` is the type either way — it already
    // carries the single `?`, and applying the modifiers would add a
    // second one.
    return 'Any?'
  }
}

// `OasVoid` is not part of the `OasSchema` union, so it can't flow through
// `SnippetBase.schema` — a void snippet inherits its ancestor /
// key-derived pointer.
type KotlinVoidArgs = {
  context: GenerateContextType
  generatorKey: GeneratorKey
  destinationPath: string
}

export class KotlinVoid extends KtSnippet {
  type = 'void' as const

  constructor({ context, generatorKey }: KotlinVoidArgs) {
    super({ context, generatorKey })
  }

  override toString(): string {
    // SLOT(void)
    return 'Unit'
  }
}
