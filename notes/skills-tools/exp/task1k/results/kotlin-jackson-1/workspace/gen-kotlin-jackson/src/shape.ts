import { isEmpty } from '@skmtc/core'
import type {
  GenerateContextType,
  OasObject,
  OasRef,
  OasSchema,
  OasString,
  RefName,
} from '@skmtc/core'
import type { KtEntityType } from '@skmtc/lang-kotlin'

type ModelSchema = OasSchema | OasRef<'schema'>

/**
 * Read a component schema WITHOUT the side effect `resolveSchemaRefOnce`
 * carries: that method bumps `context.modelDepth`, the counter the
 * recursion protocol reads, so an identity static calling it would report
 * a cycle that never happened. Identity is computed before construction,
 * so it has to stay side-effect free.
 *
 * A leaf module by design — imported by `base.ts` AND by the projection,
 * it must not close a load-time cycle back through either.
 */
export const peekSchema = (
  context: GenerateContextType,
  refName: RefName,
): ModelSchema | undefined => {
  if (context.document.type !== 'oas') {
    return undefined
  }

  return context.document.value.components?.schemas?.[refName]?.resolveOnce()
}

/**
 * An object with properties → `data class Name(…)`.
 *
 * Presence-tested rather than `schema.type === 'object'`: only the router
 * gets to decide what a schema TYPE renders as (`skmtc/single-dispatch`),
 * and what these two guards actually need is the field that carries the
 * declaration's contents.
 */
export const isDataClassSchema = (schema: ModelSchema): schema is OasObject => {
  if (!('properties' in schema)) {
    return false
  }

  const { properties } = schema

  return properties !== undefined && properties !== null && !isEmpty(properties)
}

/** A string with enum members → `enum class Name { … }`. */
export const isEnumClassSchema = (schema: ModelSchema): schema is OasString => {
  if ('properties' in schema || !('enums' in schema) || !schema.enums) {
    return false
  }

  // `enums` also appears on numeric schemas; only STRING members can be an
  // `enum class` whose wire form Jackson reads from `@JsonProperty`.
  const enums: readonly unknown[] = schema.enums

  return enums.length > 0 &&
    enums.every((value) => value === null || typeof value === 'string')
}

/**
 * The shape dispatch — ONE deterministic function, read by both
 * `toIdentifierType` (which decides the declaration head) and
 * `KotlinProjection` (which builds the value that follows it), so the
 * kind and the value can never disagree.
 *
 * Everything else — a bare scalar, an untyped object, a union — becomes a
 * `typealias` over a type expression. That is also what routes an EMPTY
 * object away from `data class Name()`, which Kotlin rejects.
 */
export const toModelShape = (
  context: GenerateContextType,
  refName: RefName,
): KtEntityType => {
  const schema = peekSchema(context, refName)

  if (!schema) {
    return 'typealias'
  }

  if (isDataClassSchema(schema)) {
    return 'data-class'
  }

  if (isEnumClassSchema(schema)) {
    return 'enum-class'
  }

  return 'typealias'
}
