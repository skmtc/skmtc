import {
  emptyEnrichmentSchema,
  toRefName,
  type CustomValue,
  type EmptyEnrichments,
  type GenerateContextType,
  type ModelProjectionConstructorArgs,
  type OasObject,
  type OasRef,
  type OasSchema,
  type RefName,
  type Stringable
} from '@skmtc/core'
import { register, sanitizePropertyName, toTsModelProjectionBase } from '@skmtc/lang-typescript'
import { effectModule, generatorId, schemaNamespace } from './constants.ts'
import { toSchemaExportPath, toSchemaName } from './naming.ts'

/** Anything that can occupy a property slot of a parsed OAS object. */
type SchemaNode = OasSchema | OasRef<'schema'> | CustomValue

/** What every render step needs: the context, and the file being written. */
type RenderArgs = {
  context: GenerateContextType
  destinationPath: string
}

/**
 * Ref names whose projection is mid-construction, per generate context.
 *
 * A `$ref` back to a name already on this stack closes a cycle: re-entering
 * `insertModel` would recurse forever, because the Driver only caches a
 * definition *after* the projection constructor returns. Those edges render
 * as a lazy `Schema.suspend(...)` instead.
 */
const inFlightByContext = new WeakMap<GenerateContextType, Set<RefName>>()

const toInFlight = (context: GenerateContextType): Set<RefName> => {
  const existing = inFlightByContext.get(context)

  if (existing) {
    return existing
  }

  const created = new Set<RefName>()
  inFlightByContext.set(context, created)

  return created
}

/** Indents every line but the first — used when nesting a rendered value. */
const indent = (value: Stringable): string => value.toString().split('\n').join('\n  ')

const toLiteralArgs = (values: readonly (string | number | null)[]): string =>
  values.map(value => (typeof value === 'string' ? `'${value}'` : String(value))).join(', ')

/**
 * Renders a `$ref` edge.
 *
 * The common case delegates to `insertModel`, which materialises the peer's
 * definition in its own file — exactly once, however many times it is
 * referenced — and stitches the import into `destinationPath`. A ref that
 * closes a cycle becomes a `Schema.suspend` thunk: the binding it names is
 * only read lazily, so a self-recursive model needs no import at all and a
 * mutually-recursive one needs a plain one.
 */
const toRefValue = (refName: RefName, { context, destinationPath }: RenderArgs): Stringable => {
  if (!toInFlight(context).has(refName)) {
    return context.insertModel(EffectSchema, refName, { destinationPath }).toName()
  }

  const settings = context.toModelContentSettings({ refName, projection: EffectSchema })
  const name = settings.identifier.name

  // `register` drops self-imports, so the self-recursive case is a no-op.
  register(context, { imports: { [settings.exportPath]: [name] }, destinationPath })

  return `${schemaNamespace}.suspend((): ${schemaNamespace}.Schema<any> => ${name})`
}

/** Renders an object schema as `Schema.Struct({ ... })`. */
const toStructValue = ({ properties, required }: OasObject, args: RenderArgs): Stringable => {
  const entries = Object.entries(properties ?? {}).map(([name, property]) => {
    const value = toEffectValue(property, args)
    const wrapped = required?.includes(name)
      ? value
      : `${schemaNamespace}.optional(${value.toString()})`

    return indent(`${sanitizePropertyName(name)}: ${wrapped}`)
  })

  return entries.length
    ? `${schemaNamespace}.Struct({\n  ${entries.join(',\n  ')}\n})`
    : `${schemaNamespace}.Struct({})`
}

/**
 * The router: the single place `schema.type` decides what renders a node.
 * Wraps the result in `Schema.NullOr` for a nullable schema.
 */
const toEffectValue = (schema: SchemaNode, args: RenderArgs): Stringable => {
  const value = ((): Stringable => {
    switch (schema.type) {
      case 'custom':
        return schema.value
      case 'ref':
        return toRefValue(toRefName(schema.$ref), args)
      case 'object':
        return toStructValue(schema, args)
      case 'array':
        return `${schemaNamespace}.Array(${indent(toEffectValue(schema.items, args))})`
      case 'union':
        return `${schemaNamespace}.Union(${schema.members
          .map(member => indent(toEffectValue(member, args)))
          .join(', ')})`
      case 'string':
        return schema.enums?.length
          ? `${schemaNamespace}.Literal(${toLiteralArgs(schema.enums)})`
          : `${schemaNamespace}.String`
      case 'integer':
      case 'number':
        return schema.enums?.length
          ? `${schemaNamespace}.Literal(${toLiteralArgs(schema.enums)})`
          : `${schemaNamespace}.Number`
      case 'boolean':
        return `${schemaNamespace}.Boolean`
      default:
        return `${schemaNamespace}.Unknown`
    }
  })()

  return 'nullable' in schema && schema.nullable === true
    ? `${schemaNamespace}.NullOr(${value})`
    : value
}

const base = toTsModelProjectionBase<EmptyEnrichments>({
  id: generatorId,
  toIdentifierName: ({ refName }) => toSchemaName(refName),
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath: ({ refName }) => toSchemaExportPath(refName),
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

/**
 * The effect `Schema` value for one OpenAPI model — the right-hand side of
 * `export const <Name> = ...` in `@/models/<Name>.generated.ts`.
 */
export class EffectSchema extends base {
  value: Stringable

  constructor(args: ModelProjectionConstructorArgs<EmptyEnrichments>) {
    super(args)

    const { context, settings } = this
    const destinationPath = settings.exportPath

    this.register({ imports: { [effectModule]: [schemaNamespace] } })

    const inFlight = toInFlight(context)
    inFlight.add(this.refName)

    try {
      this.value = toEffectValue(context.resolveSchemaRefOnce(this.refName, generatorId), {
        context,
        destinationPath
      })
    } finally {
      inFlight.delete(this.refName)
    }
  }

  override toString(): string {
    return this.value.toString()
  }
}
