import * as v from 'valibot'
import isEqual from 'lodash-es/isEqual'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { numberFormat } from '@/oas/number/number-types.ts'
import { integerFormat } from '@/oas/integer/integer-types.ts'

/**
 * The keywords next to a reference in a one-member `allOf`
 * (`{ allOf: [{ $ref }], minLength: 3, description: '…' }`), the use-site
 * flags `nullable`, `readOnly` and `writeOnly` among them: the fields a
 * reference adds at its site (`RefFields`).
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
   * Use-site nullability. A `$ref` is a per-reference node: the same
   * refName may be referenced nullable at one site and non-nullable at
   * another, so nullability rides the reference, not the shared referent.
   * Set by the single-member `oneOf`/`anyOf` collapse for the 3.1
   * `oneOf:[{$ref},{type:null}]` idiom, and next to a one-member `allOf`.
   * Generators read it off the reference (`'nullable' in schema ?
   * schema.nullable`) to render `Foo | null`, while `ModelDriver` builds the
   * un-nullable shared model from the refName.
   */
  nullable?: boolean
  /**
   * Use-site `readOnly`: set where a property marks a reference read-only,
   * `{ allOf: [{ $ref }], readOnly: true }` (the 3.0 idiom, as keywords next
   * to a bare `$ref` are ignored there). Like `nullable`, it rides the
   * reference: the shared model is not read-only everywhere. Read it through
   * `isReadOnly`, which also looks at what the reference points to.
   */
  readOnly?: boolean
  /** Use-site `writeOnly`, as {@link readOnly}. */
  writeOnly?: boolean
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

/**
 * The use-site flags, taken by every type, so they are never reported as
 * left out. A union's or unknown's copy has no `readOnly` or `writeOnly`
 * field, but the reference still answers `isReadOnly()` and
 * `isWriteOnly()` from its own flag.
 */
const FLAGS: SiblingKeyword[] = ['nullable', 'readOnly', 'writeOnly']
const DESCRIBING: SiblingKeyword[] = [...FLAGS, 'title', 'description', 'extensionFields', 'example']
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
 * with what another site adds (`OasRef.clone`): a flag set on either stays
 * set, a keyword `over` sets wins, extension fields and `properties` merge,
 * and `required` names add up, as each schema class's `clone` merges them
 * into a schema.
 */
export const mergeSiblingKeywords = (base: SiblingKeywords, over: SiblingKeywords | undefined): SiblingKeywords => ({
  nullable: base.nullable || over?.nullable || undefined,
  readOnly: base.readOnly || over?.readOnly || undefined,
  writeOnly: base.writeOnly || over?.writeOnly || undefined,
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

/** Keywords that `clone` merges with `||`: `false` and absent mean the same. */
const BOOLEAN_KEYWORDS: SiblingKeyword[] = [
  'nullable',
  'readOnly',
  'writeOnly',
  'deprecated',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'uniqueItems'
]

/**
 * The keywords next to a reference that make `copy` (the target with them
 * applied) differ from `target`. A keyword the target's type does not take,
 * a flag the target already has, and a value equal to the target's change
 * nothing.
 */
const toChangedKeywords = (copy: OasSchema, target: OasSchema, siblings: SiblingKeywords): SiblingKeyword[] =>
  SIBLINGS_BY_TYPE[target.type].filter(keyword => {
    if (siblings[keyword] === undefined) {
      return false
    }

    const applied: unknown = Reflect.get(copy, keyword)
    const original: unknown = Reflect.get(target, keyword)

    return BOOLEAN_KEYWORDS.includes(keyword) ? (applied === true) !== (original === true) : !isEqual(applied, original)
  })

/** Whether the keywords next to a reference change `target` at that site. The engine behind `OasRef.resolve`. */
export const changesTarget = (copy: OasSchema, target: OasSchema, siblings: SiblingKeywords): boolean =>
  toChangedKeywords(copy, target, siblings).length > 0

/**
 * Whether the keywords next to a reference change which values `target`
 * accepts at that site (`minLength` next to a string, `properties` next to an
 * object), not only how it is described (`description`, `deprecated`,
 * `default`, `x-*`). The engine behind `OasRef.hasValueSiblings`.
 */
export const changesValues = (copy: OasSchema, target: OasSchema, siblings: SiblingKeywords): boolean =>
  toChangedKeywords(copy, target, siblings).some(keyword => VALUE_KEYWORDS.includes(keyword))

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
