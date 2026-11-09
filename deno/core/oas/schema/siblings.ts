import * as v from 'valibot'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { CustomValue } from '@/dsl/CustomValue.ts'
import { numberFormat } from '@/oas/number/number-types.ts'
import { integerFormat } from '@/oas/integer/integer-types.ts'

/**
 * The keywords next to a reference in a one-member `allOf`
 * (`{ allOf: [{ $ref }], minLength: 3, description: '…' }`), other than the
 * use-site flags `nullable`, `readOnly` and `writeOnly`, which ride the
 * reference on their own (`RefFields`).
 *
 * The parser reads them without knowing the target's type: the reference
 * stays lazy. Each schema class's `clone(ref)` takes the keywords its type
 * has ({@link SIBLINGS_BY_TYPE}). A value whose type depends on the target
 * (`example`, `default`, `enums`, `format`) is kept as written, and `clone`
 * takes it only when it fits. {@link toSkippedSiblings} names the keywords
 * `clone` leaves out, for a generator to log.
 */
export type SiblingKeywords = {
  /**
   * The `type` written next to the reference, merged in from the schema that
   * holds the one-member `allOf`. It must agree with the target's; the copy
   * always has the target's type. Not `type`, which on an `OasRef` is `'ref'`.
   */
  _type?: unknown
  title?: string
  description?: string
  deprecated?: boolean
  example?: unknown
  default?: unknown
  enums?: unknown[]
  extensionFields?: Record<string, unknown>
  format?: string
  minLength?: number
  maxLength?: number
  pattern?: string
  multipleOf?: number
  minimum?: number
  maximum?: number
  exclusiveMinimum?: boolean
  exclusiveMaximum?: boolean
  minItems?: number
  maxItems?: number
  uniqueItems?: boolean
  properties?: Record<string, OasSchema | OasRef<'schema'>>
  required?: string[]
  additionalProperties?: boolean | OasSchema | OasRef<'schema'>
  minProperties?: number
  maxProperties?: number
}

/** A keyword `clone` can apply. `_type` only has to agree. */
export type SiblingKeyword = Exclude<keyof SiblingKeywords, '_type'>

const DESCRIBING: SiblingKeyword[] = ['title', 'description', 'extensionFields', 'example']
const NUMERIC: SiblingKeyword[] = [
  'deprecated',
  'default',
  'enums',
  'format',
  'multipleOf',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum'
]

/** The keywords each schema class's `clone` takes: the fields its type has. */
export const SIBLINGS_BY_TYPE: Record<OasSchema['type'], SiblingKeyword[]> = {
  string: [...DESCRIBING, 'deprecated', 'default', 'enums', 'format', 'minLength', 'maxLength', 'pattern'],
  number: [...DESCRIBING, ...NUMERIC],
  integer: [...DESCRIBING, ...NUMERIC],
  boolean: [...DESCRIBING, 'deprecated', 'default', 'enums'],
  array: [...DESCRIBING, 'deprecated', 'default', 'enums', 'minItems', 'maxItems', 'uniqueItems'],
  object: [
    ...DESCRIBING,
    'deprecated',
    'default',
    'enums',
    'properties',
    'required',
    'additionalProperties',
    'minProperties',
    'maxProperties'
  ],
  union: [...DESCRIBING, 'default'],
  unknown: DESCRIBING
}

/** Every keyword `clone` can apply, for any type. */
const SIBLING_KEYWORDS: SiblingKeyword[] = [...new Set(Object.values(SIBLINGS_BY_TYPE).flat())]

/**
 * The keywords of `over` merged over those of `base`, for a reference copied
 * with what another site adds (`OasRef.clone`): a keyword `over` sets wins,
 * extension fields and `properties` merge, and `required` names add up, as
 * each schema class's `clone` merges them into a schema.
 */
export const mergeSiblingKeywords = (base: SiblingKeywords, over: SiblingKeywords | undefined): SiblingKeywords => ({
  _type: over?._type ?? base._type,
  title: over?.title ?? base.title,
  description: over?.description ?? base.description,
  deprecated: over?.deprecated ?? base.deprecated,
  example: over?.example ?? base.example,
  default: over?.default ?? base.default,
  enums: over?.enums ?? base.enums,
  extensionFields: base.extensionFields === undefined && over?.extensionFields === undefined
    ? undefined
    : { ...base.extensionFields, ...over?.extensionFields },
  format: over?.format ?? base.format,
  minLength: over?.minLength ?? base.minLength,
  maxLength: over?.maxLength ?? base.maxLength,
  pattern: over?.pattern ?? base.pattern,
  multipleOf: over?.multipleOf ?? base.multipleOf,
  minimum: over?.minimum ?? base.minimum,
  maximum: over?.maximum ?? base.maximum,
  exclusiveMinimum: over?.exclusiveMinimum ?? base.exclusiveMinimum,
  exclusiveMaximum: over?.exclusiveMaximum ?? base.exclusiveMaximum,
  minItems: over?.minItems ?? base.minItems,
  maxItems: over?.maxItems ?? base.maxItems,
  uniqueItems: over?.uniqueItems ?? base.uniqueItems,
  properties: over?.properties === undefined ? base.properties : { ...base.properties, ...over.properties },
  required: over?.required === undefined ? base.required : [...new Set([...(base.required ?? []), ...over.required])],
  additionalProperties: over?.additionalProperties ?? base.additionalProperties,
  minProperties: over?.minProperties ?? base.minProperties,
  maxProperties: over?.maxProperties ?? base.maxProperties
})

/** Whether `siblings` holds any keyword. */
export const hasSiblingKeywords = (siblings: SiblingKeywords): boolean =>
  siblings._type !== undefined || SIBLING_KEYWORDS.some(keyword => siblings[keyword] !== undefined)

/** The keywords that change which values a site accepts, not only how it is described. */
const VALUE_KEYWORDS: SiblingKeyword[] = [
  'enums',
  'format',
  'minLength',
  'maxLength',
  'pattern',
  'multipleOf',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minItems',
  'maxItems',
  'uniqueItems',
  'properties',
  'required',
  'additionalProperties',
  'minProperties',
  'maxProperties'
]

/**
 * Whether the keywords next to a reference change which values `target`
 * accepts at that site (`minLength` next to a string, `properties` next to an
 * object), not only how it is described (`description`, `deprecated`,
 * `default`, `x-*`). A keyword the target's type does not take changes
 * nothing. The engine behind `OasRef.hasValueSiblings`.
 */
export const changesValues = (target: OasSchema, siblings: SiblingKeywords): boolean =>
  SIBLINGS_BY_TYPE[target.type].some(keyword => VALUE_KEYWORDS.includes(keyword) && siblings[keyword] !== undefined)

/**
 * The keywords next to a reference that `clone` leaves out for `target`, by
 * their names in the document: one its type does not have (`minLength` next
 * to an array), a `type` that disagrees with the target's, and an `example`,
 * `default`, `enum` or `format` whose value does not fit. `nullable` says
 * whether the site takes `null` among the `enum` members. The engine behind
 * `OasRef.toSkippedSiblings`.
 */
export const toSkippedSiblings = (
  target: OasSchema,
  siblings: SiblingKeywords,
  nullable: boolean | undefined
): string[] => {
  const taken = SIBLINGS_BY_TYPE[target.type]
  const fits = VALUE_CHECKS[target.type]

  const isSkipped = (keyword: SiblingKeyword, value: unknown): boolean => {
    if (value === undefined) {
      return false
    }

    if (!taken.includes(keyword)) {
      return true
    }

    switch (keyword) {
      case 'example':
      case 'default':
        return !fits(value)
      case 'enums':
        return !Array.isArray(value) || !value.every(item => fits(item) || (nullable === true && item === null))
      case 'format':
        return !fitsFormat(target.type, value)
      default:
        return false
    }
  }

  const type = siblings._type !== undefined && !agrees(siblings._type, target, 0) ? ['type'] : []
  const others = SIBLING_KEYWORDS.filter(keyword => isSkipped(keyword, siblings[keyword])).map(toDocumentKeyword)

  return [...type, ...others]
}

/** How deep {@link agrees} follows union members, so a union that contains itself ends. */
const MAX_DEPTH = 10

/**
 * A `type` next to a reference agrees with the target's when it names it, or
 * `number` for an integer. Next to a union, it agrees when every member,
 * followed through references, has that type (`type: object` next to a
 * `oneOf` of objects): leaving it out then loses nothing.
 */
const agrees = (type: unknown, target: OasSchema, depth: number): boolean => {
  if (target.type === 'union') {
    return depth < MAX_DEPTH &&
      target.members.every(member => agrees(type, member.isRef() ? member.resolve() : member, depth + 1))
  }

  return type === target.type || (type === 'number' && target.type === 'integer')
}

/** Whether `format` fits a schema of `type`, as `clone` reads it: any string for a string. */
const fitsFormat = (type: OasSchema['type'], format: unknown): boolean => {
  switch (type) {
    case 'number':
      return isNumberFormat(format)
    case 'integer':
      return isIntegerFormat(format)
    default:
      return isStringValue(format)
  }
}

/** The document's name for a keyword: `enum` for `enums`. */
const toDocumentKeyword = (keyword: SiblingKeyword): string => (keyword === 'enums' ? 'enum' : keyword)

/** The annotations of `target` with those of `siblings` applied: a sibling's value wins, and extension fields merge. */
export const toSiblingAnnotations = (target: OasSchema, siblings: SiblingKeywords | undefined) => ({
  title: siblings?.title ?? target.title,
  description: siblings?.description ?? target.description,
  extensionFields: target.extensionFields === undefined && siblings?.extensionFields === undefined
    ? undefined
    : { ...target.extensionFields, ...siblings?.extensionFields }
})

/** The value checks the parser makes for `example`, `default` and each `enum` member, by type. */
export const isStringValue = (value: unknown): value is string => typeof value === 'string'
export const isNumberValue = (value: unknown): value is number => typeof value === 'number'
export const isIntegerValue = (value: unknown): value is number => Number.isInteger(value)
export const isBooleanValue = (value: unknown): value is boolean => typeof value === 'boolean'
export const isArrayValue = (value: unknown): value is unknown[] => Array.isArray(value)
export const isObjectValue = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isAnyValue = (_value: unknown): _value is unknown => true

/** {@link isStringValue} and the others, keyed by the type they check for. A union or unknown takes any value. */
export const VALUE_CHECKS: Record<OasSchema['type'], (value: unknown) => boolean> = {
  string: isStringValue,
  number: isNumberValue,
  integer: isIntegerValue,
  boolean: isBooleanValue,
  array: isArrayValue,
  object: isObjectValue,
  union: isAnyValue,
  unknown: isAnyValue
}

/** The formats a number and an integer take. A string takes any format. */
export const isNumberFormat = (value: unknown): value is 'float' | 'double' => v.is(numberFormat, value)
export const isIntegerFormat = (value: unknown): value is 'int32' | 'int64' => v.is(integerFormat, value)

/** `value` when it passes `check`, else `undefined`: for `example`, `default` and `format`. */
export const toSiblingValue = <T>(value: unknown, check: (value: unknown) => value is T): T | undefined =>
  check(value) ? value : undefined

/**
 * `enums` when every member passes `check`, or is `null` at a nullable site,
 * else `undefined`. The parser reports the members that do not.
 */
export const toSiblingEnums = <T>(
  enums: unknown[] | undefined,
  check: (value: unknown) => value is T,
  nullable: boolean | undefined
): (T | null)[] | undefined =>
  enums?.every((item): item is T | null => check(item) || (nullable === true && item === null)) ? enums : undefined

/**
 * Whether inlining the schema at this site would not end: the copy reaches,
 * through other sites a generator inlines (`OasRef.hasValueSiblings`), a site
 * that refers to a model already being inlined. A reference without such
 * keywords renders by name, so it stops the walk. The engine behind
 * `OasRef.isSiblingLoop`.
 */
export const isInlineLoop = (ref: OasRef<'schema'>): boolean => reachesInlined(ref, new Set())

const reachesInlined = (ref: OasRef<'schema'>, inlining: Set<string>): boolean => {
  const name = ref.toRefName()

  if (inlining.has(name)) {
    return true
  }

  const next = new Set([...inlining, name])

  return childrenOf(ref.resolve()).some(child => reachesThrough(child, next))
}

const reachesThrough = (child: OasSchema | OasRef<'schema'> | CustomValue, inlining: Set<string>): boolean => {
  if (child.isRef()) {
    return child.hasValueSiblings() && reachesInlined(child, inlining)
  }

  return child.type !== 'custom' && childrenOf(child).some(grandchild => reachesThrough(grandchild, inlining))
}

/** The schemas a schema renders inside itself: properties, a record's values, items, members. */
const childrenOf = (schema: OasSchema): (OasSchema | OasRef<'schema'> | CustomValue)[] => {
  switch (schema.type) {
    case 'object':
      return [
        ...Object.values(schema.properties ?? {}),
        ...(typeof schema.additionalProperties === 'object' ? [schema.additionalProperties] : [])
      ]
    case 'array':
      return [schema.items]
    case 'union':
      return schema.members
    default:
      return []
  }
}
