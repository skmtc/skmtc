/**
 * The schema-to-value router plus the TypeBox snippet classes. Every
 * branch returns a snippet object; text exists only inside toString().
 */
import {
  ModelDriver,
  toGeneratorOnlyKey,
  type GenerateContextType,
  type GeneratorKey,
  type OasRef,
  type RefName,
  type Stringable
} from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import { match } from 'ts-pattern'
import { typeboxEntry } from './mod.ts'
import { TypeBoxProjection } from './TypeBoxProjection.ts'

type SchemaLike = {
  type?: string
  isRef: () => boolean
  stackTrail: { clone: () => unknown }
}

type ToTypeBoxValueArgs = {
  // deno-lint-ignore no-explicit-any
  schema: any
  required: boolean
  destinationPath: string
  context: GenerateContextType
  rootRef?: RefName
}

type SnippetArgs = {
  context: GenerateContextType
  destinationPath: string
  generatorKey: GeneratorKey
  // deno-lint-ignore no-explicit-any
  stackTrail?: any
}

/** Base for all TypeBox snippets: registers the Type import on construction. */
class TbSnippet extends TsSnippet {
  nullable: boolean

  constructor({ context, destinationPath, generatorKey, stackTrail }: SnippetArgs, nullable: boolean) {
    super({ context, generatorKey, stackTrail })
    this.nullable = nullable
    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  withNullable(content: string): string {
    return this.nullable ? `Type.Union([${content}, Type.Null()])` : content
  }
}

class TbString extends TbSnippet {
  enums: string[] | undefined

  constructor(args: SnippetArgs, nullable: boolean, enums: string[] | undefined) {
    super(args, nullable)
    this.enums = enums
  }

  override toString(): string {
    const content = this.enums?.length
      ? `Type.Union([${this.enums.map(value => `Type.Literal('${value}')`).join(', ')}])`
      : `Type.String()`
    return this.withNullable(content)
  }
}

class TbScalar extends TbSnippet {
  factory: string

  constructor(args: SnippetArgs, nullable: boolean, factory: string) {
    super(args, nullable)
    this.factory = factory
  }

  override toString(): string {
    return this.withNullable(`Type.${this.factory}()`)
  }
}

class TbArray extends TbSnippet {
  items: Stringable

  constructor(args: SnippetArgs, nullable: boolean, items: Stringable) {
    super(args, nullable)
    this.items = items
  }

  override toString(): string {
    return this.withNullable(`Type.Array(${this.items})`)
  }
}

type TbProperty = {
  key: string
  value: Stringable
  required: boolean
}

class TbObject extends TbSnippet {
  properties: TbProperty[]

  constructor(args: SnippetArgs, nullable: boolean, properties: TbProperty[]) {
    super(args, nullable)
    this.properties = properties
  }

  override toString(): string {
    const fields = this.properties
      .map(({ key, value, required }) => {
        const wrapped = required ? `${value}` : `Type.Optional(${value})`
        return `${key}: ${wrapped}`
      })
      .join(',\n  ')
    return this.withNullable(`Type.Object({\n  ${fields}\n})`)
  }
}

/** A $ref: the Driver resolves the peer (cache hit or recursive miss) and
 *  stitches the cross-file import; only the NAME lands in this tree. */
class TbRef extends TsSnippet {
  name: string

  constructor({
    context,
    refName,
    destinationPath,
    rootRef
  }: {
    context: GenerateContextType
    refName: RefName
    destinationPath: string
    rootRef?: RefName
  }) {
    super({ context })

    const { settings } = new ModelDriver({
      context,
      refName,
      destinationPath,
      rootRef,
      projection: TypeBoxProjection,
      variant: 'main'
    })

    this.name = settings.identifier.name
  }

  override toString(): string {
    return this.name
  }
}

export const toTypeBoxValue = ({
  schema,
  required: _required,
  destinationPath,
  context,
  rootRef
}: ToTypeBoxValueArgs): Stringable => {
  if (schema.isRef?.()) {
    const ref = schema as OasRef<'schema'>
    return new TbRef({ context, refName: ref.toRefName(), destinationPath, rootRef })
  }

  const generatorKey = toGeneratorOnlyKey({ generatorId: typeboxEntry.id })
  const nullable = 'nullable' in schema ? schema.nullable === true : false
  const base: SnippetArgs = {
    context,
    destinationPath,
    generatorKey,
    stackTrail: (schema as SchemaLike).stackTrail?.clone?.()
  }

  return match(schema)
    .with({ type: 'string' }, stringSchema => new TbString(base, nullable, stringSchema.enums))
    .with({ type: 'integer' }, () => new TbScalar(base, nullable, 'Integer'))
    .with({ type: 'number' }, () => new TbScalar(base, nullable, 'Number'))
    .with({ type: 'boolean' }, () => new TbScalar(base, nullable, 'Boolean'))
    .with({ type: 'array' }, arraySchema => {
      const items = toTypeBoxValue({
        schema: arraySchema.items,
        required: true,
        destinationPath,
        context,
        rootRef
      })
      return new TbArray(base, nullable, items)
    })
    .with({ type: 'object' }, objectSchema => {
      const required: string[] = objectSchema.required ?? []
      const properties: TbProperty[] = Object.entries(objectSchema.properties ?? {}).map(
        ([key, propertySchema]) => ({
          key,
          value: toTypeBoxValue({
            schema: propertySchema,
            required: required.includes(key),
            destinationPath,
            context,
            rootRef
          }),
          required: required.includes(key)
        })
      )
      return new TbObject(base, nullable, properties)
    })
    .otherwise(() => new TbScalar(base, nullable, 'Unknown'))
}
