/**
 * The cases where what the OpenAPI rules say and what API documents mean by it
 * differ, and which of the two core follows. This file is the record: a test
 * that fails here means that a decision changed. Change the case in the same
 * pull request, and say why.
 *
 * To choose a reading for a new case:
 * 1. When both readings accept the same values, parse to the simplest schema.
 * 2. When they differ, follow the rules.
 * 3. Follow practice instead only when the meaning is clear and the case is
 *    common.
 *
 * `reading`:
 * - `rules`: core does what the specification of the version says.
 * - `practice`: core does what authors mean.
 * - `neither`: decided to stay as it is. The case is rare, core reports it, and
 *   either reading takes more code than it is worth.
 * - `undecided`: no reading is chosen, and core may do neither. The test states
 *   what it does today, so the case is not forgotten. It is no reason to keep
 *   the result. `ticket` is where it is to be decided, when there is one.
 *
 * `documents`: how many of the 1,981 harvest documents have the case
 * (2026-11-25), from the raw documents. A case without a type counts only
 * schemas that are no member of a union or an allOf, where a type can come from
 * beside it. The type beside a kept ref is 0 from the parsed result.
 */

import { assertEquals } from '@std/assert'
import { parseBounded } from '@/test/parseBounded.ts'

type Version = '3.0.3' | '3.1.0' | '3.2.0'

type EdgeCase = {
  name: string
  rules: string
  practice: string
  reading: 'rules' | 'practice' | 'neither' | 'undecided'
  ticket?: string
  documents: number | 'not counted'
  versions: Version[]
  /** The schema `X`, and the schemas it refers to beside `Obj` and `OrNull`. */
  x: (version: Version) => unknown
  /** `X` as `toJsonSchema` writes it; `undefined` when it is removed. */
  expected: unknown
  /** The types of the issues. */
  issues?: string[]
}

const ALL: Version[] = ['3.0.3', '3.1.0', '3.2.0']
const V30: Version[] = ['3.0.3']
const V31: Version[] = ['3.1.0', '3.2.0']

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const text = { type: 'string' }

/** A schema of one type that allows `null`, as the version writes it. */
const orNull = (version: Version, type: string) =>
  version === '3.0.3' ? { type, nullable: true } : { type: [type, 'null'] }

/** An object as `toJsonSchema` writes it: it closes an object that says nothing. */
const closed = (properties: Record<string, unknown>) => ({ type: 'object', properties, additionalProperties: false })

const cases: EdgeCase[] = [
  {
    name: 'nullable beside an allOf of one ref to a schema that is not nullable',
    rules: 'null is not valid: the target rejects it',
    practice: 'the target or null',
    reading: 'practice',
    documents: 175,
    versions: ALL,
    x: () => ({ nullable: true, allOf: [ref('Obj')] }),
    expected: { ...ref('Obj'), nullable: true }
  },
  {
    name: 'an allOf where only one member allows null',
    rules: 'null is not valid: it must be valid against each member',
    practice: 'null is valid: the nullable member says so',
    reading: 'practice',
    documents: 39,
    versions: ALL,
    x: () => ({ allOf: [ref('OrNull'), { type: 'object', properties: { b: text } }] }),
    expected: { ...closed({ a: text, b: text }), nullable: true }
  },
  {
    name: 'a type beside a kept ref to a schema that allows null',
    rules: 'null is not valid: the type excludes it',
    practice: 'not clear, so the rules decide',
    reading: 'rules',
    documents: 0,
    versions: ALL,
    x: () => ({ type: 'object', properties: { self: { allOf: [ref('X'), ref('Loop'), { type: 'object' }] } } }),
    expected: {
      ...closed({}),
      properties: { self: { allOf: [ref('X'), ref('Loop'), { type: 'object', additionalProperties: false }] } }
    }
  },
  {
    name: 'a nullable type with an enum that does not list null',
    rules: 'null is not valid: it is not in the enum',
    practice: 'null is valid: nullable says so',
    reading: 'practice',
    documents: 356,
    versions: ALL,
    x: version => ({ ...orNull(version, 'string'), enum: ['a'] }),
    expected: { type: 'string', nullable: true, enum: ['a'] }
  },
  {
    name: 'an enum that lists null, with a type that does not allow it',
    rules: '"a" is the one valid value',
    practice: '"a" or null',
    // The whole enum is removed, so any string is valid.
    reading: 'undecided',
    ticket: 'skmtc#399',
    documents: 33,
    versions: ALL,
    x: () => ({ type: 'string', enum: ['a', null] }),
    expected: { type: 'string' },
    issues: ['INVALID_ENUM']
  },
  {
    name: 'an integer with an enum of strings',
    rules: 'no value is valid',
    practice: 'the integers that the strings write',
    // The whole enum is removed, so any integer is valid.
    reading: 'neither',
    documents: 26,
    versions: ALL,
    x: () => ({ type: 'integer', enum: ['1', '2'] }),
    expected: { type: 'integer' },
    issues: ['INVALID_ENUM']
  },
  {
    name: 'nullable beside a $ref',
    rules: 'keywords beside a $ref are ignored',
    practice: 'the target or null',
    reading: 'rules',
    documents: 64,
    versions: V30,
    x: () => ({ ...ref('Obj'), nullable: true }),
    expected: ref('Obj'),
    issues: ['UNEXPECTED_PROPERTY']
  },
  {
    name: 'nullable beside a $ref, in a version without the keyword',
    rules: 'nullable is not a keyword',
    practice: 'the target or null',
    reading: 'practice',
    documents: 41,
    versions: V31,
    x: () => ({ ...ref('Obj'), nullable: true }),
    expected: { ...ref('Obj'), nullable: true }
  },
  {
    name: 'nullable beside a type, in a version without the keyword',
    rules: 'nullable is not a keyword: null is not valid',
    practice: 'null is valid',
    reading: 'practice',
    documents: 246,
    versions: V31,
    x: () => ({ type: 'string', nullable: true }),
    expected: { type: 'string', nullable: true }
  },
  {
    name: 'a union member of type null, in a version without that type',
    rules: 'null is not a type',
    practice: 'the target or null',
    // The member is left out with no issue, so null is lost.
    reading: 'undecided',
    ticket: 'skmtc#398',
    documents: 24,
    versions: V30,
    x: () => ({ oneOf: [ref('Obj'), { type: 'null' }] }),
    expected: ref('Obj')
  },
  {
    name: 'a list of types, in a version that takes one',
    rules: 'a type is one string',
    practice: 'one of the types, as in 3.1',
    // Any value is valid, with no issue.
    reading: 'undecided',
    ticket: 'skmtc#397',
    documents: 20,
    versions: V30,
    x: () => ({ type: ['string', 'integer'] }),
    expected: {}
  },
  {
    name: 'properties without a type',
    rules: 'a value that is not an object is valid too',
    practice: 'an object',
    reading: 'practice',
    documents: 197,
    versions: V30,
    x: () => ({ properties: { a: text } }),
    expected: closed({ a: text }),
    issues: ['MISSING_OBJECT_TYPE']
  },
  {
    name: 'properties without a type, in 3.1 and 3.2',
    rules: 'a value that is not an object is valid too',
    practice: 'an object',
    reading: 'practice',
    documents: 102,
    versions: V31,
    x: () => ({ properties: { a: text } }),
    expected: closed({ a: text })
  },
  {
    name: 'items without a type',
    rules: 'a value that is not an array is valid too',
    practice: 'an array',
    reading: 'practice',
    documents: 48,
    versions: ALL,
    x: () => ({ items: text }),
    expected: { type: 'array', items: text },
    issues: ['MISSING_ARRAY_TYPE']
  },
  {
    name: 'a string keyword without a type',
    rules: 'a string must match, and any other value is valid',
    practice: 'a string that matches',
    // The keyword is lost, with an issue.
    reading: 'neither',
    documents: 27,
    versions: ALL,
    x: () => ({ pattern: 'a' }),
    expected: {},
    issues: ['UNEXPECTED_PROPERTY']
  },
  {
    name: 'required without a type or properties',
    rules: 'an object must have the property, and any other value is valid',
    practice: 'an object with the property',
    // The keyword is lost, with an issue.
    reading: 'neither',
    documents: 20,
    versions: ALL,
    x: () => ({ required: ['a'] }),
    expected: {},
    issues: ['UNEXPECTED_PROPERTY']
  },
  {
    name: 'required: true on a property',
    rules: 'required is a list of names, on the object',
    practice: 'the property is required',
    reading: 'rules',
    documents: 22,
    versions: ALL,
    x: () => ({ type: 'object', properties: { a: { type: 'string', required: true } } }),
    expected: closed({ a: text }),
    issues: ['UNEXPECTED_PROPERTY']
  },
  {
    name: 'a default that is a string, on a number',
    rules: 'a default must match the type (3.0), or should (3.1, 3.2)',
    practice: 'the number that the string writes',
    reading: 'rules',
    documents: 148,
    versions: ALL,
    x: () => ({ type: 'integer', default: '1' }),
    expected: { type: 'integer' },
    issues: ['INVALID_DEFAULT']
  },
  {
    name: 'const, in a version without the keyword',
    rules: 'const is not a keyword',
    practice: 'the one value',
    reading: 'rules',
    documents: 12,
    versions: V30,
    x: () => ({ type: 'string', const: 'a' }),
    expected: text,
    issues: ['UNEXPECTED_PROPERTY']
  },
  {
    name: 'a numeric exclusiveMinimum, in a version where it is a boolean',
    rules: 'the document is not valid',
    practice: 'the bound, as in 3.1',
    reading: 'rules',
    documents: 5,
    versions: V30,
    x: () => ({ type: 'number', exclusiveMinimum: 1 }),
    expected: undefined,
    issues: ['INVALID_SCHEMA']
  },
  {
    name: 'additionalProperties: false beside an allOf that merges',
    rules: 'no value with a property of a member is valid: the keyword sees only the properties beside it',
    practice: 'an object with the properties of all members and no others',
    reading: 'practice',
    documents: 10,
    versions: ALL,
    x: () => ({ allOf: [ref('Obj'), { type: 'object', properties: { b: text } }], additionalProperties: false }),
    expected: closed({ a: text, b: text })
  },
  {
    name: 'additionalProperties: false beside an allOf that keeps a ref',
    rules: 'the keyword sees only the properties beside it',
    practice: 'an object with the properties of all members and no others',
    // Neither: it closes the member that the others merge into, with their properties.
    reading: 'undecided',
    ticket: 'skmtc-generators#117',
    documents: 'not counted',
    versions: ALL,
    x: () => ({ allOf: [ref('Base'), { type: 'object', properties: { b: text } }], additionalProperties: false }),
    expected: { allOf: [ref('Base'), closed({ b: text })] }
  },
  {
    name: 'a type beside an allOf of one ref to a schema with that type',
    rules: 'the target: the type says nothing more',
    practice: 'the target',
    reading: 'practice',
    documents: 'not counted',
    versions: ALL,
    x: () => ({ type: 'object', properties: { self: { type: 'object', nullable: true, allOf: [ref('X')] } } }),
    expected: closed({ self: { ...ref('X'), nullable: true } })
  },
  {
    name: 'a type beside an anyOf of one ref to a schema with that type',
    rules: 'the target: the type says nothing more',
    practice: 'the target',
    // The same schema as the case above in another spelling, with another result.
    reading: 'undecided',
    ticket: 'skmtc#402',
    documents: 'not counted',
    versions: ALL,
    x: () => ({ type: 'object', properties: { self: { type: 'object', nullable: true, anyOf: [ref('X')] } } }),
    expected: closed({
      self: { nullable: true, allOf: [{ type: 'object', additionalProperties: false }, ref('X')] }
    })
  },
  {
    name: 'a type beside an allOf of one ref to a schema that allows null',
    rules: 'null is not valid: the type excludes it',
    practice: 'not clear',
    // A ref, so null is valid. The two-member spelling excludes it: see the type beside a kept ref.
    reading: 'undecided',
    ticket: 'skmtc#402',
    documents: 'not counted',
    versions: ALL,
    x: () => ({ type: 'object', allOf: [ref('OrNull')] }),
    expected: ref('OrNull')
  },
  {
    name: 'a type that narrows, beside an allOf of one ref',
    rules: 'an integer',
    practice: 'an integer',
    // The type is left out when the ref resolves, and reported as skipped.
    reading: 'undecided',
    ticket: 'skmtc#402',
    documents: 'not counted',
    versions: ALL,
    x: () => ({ type: 'integer', allOf: [ref('Num')] }),
    expected: ref('Num')
  }
]

for (const { name, rules, practice, reading, ticket, versions, x, expected, issues = [] } of cases) {
  for (const version of versions) {
    Deno.test(`${version} ${name}: ${reading}${ticket === undefined ? '' : ` (${ticket})`}`, async () => {
      const result = await parseBounded({
        openapi: version,
        schemas: {
          X: x(version),
          Obj: { type: 'object', properties: { a: text } },
          OrNull: { ...orNull(version, 'object'), properties: { a: text } },
          Loop: { ...orNull(version, 'object'), properties: { x: ref('X') } },
          Base: { type: 'object', properties: { x: ref('X') } },
          Num: { type: 'number' }
        }
      })

      const message = `The rules: ${rules}. Practice: ${practice}.`

      assertEquals(result.schemas.X, expected, message)
      assertEquals(result.issues.map(({ type }) => type).filter(type => type !== 'INVALID_DEPENDENCY_REF'), issues, message)
    })
  }
}
