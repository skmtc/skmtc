#!/usr/bin/env -S deno run --allow-read --allow-env
/**
 * The validator's answer for each case of `core/parse/openapiEdgeCases.test.ts`,
 * next to what the case's `rules` text says.
 *
 * Run from `deno/`: `deno run -A .scripts/openapi-grid-cases.ts`.
 *
 * The text is prose, so {@link CLAIMS} has what it says as values. The cases
 * themselves are read from the test file, so the two cannot drift apart.
 */

import { isRecord } from './api-surface.ts'
import {
  type Answer,
  toRulesAnswer,
  translate,
  type Version,
  VERSIONS
} from './openapi-grid-rules.ts'

export type EdgeCase = {
  name: string
  rules: string
  reading: string
  versions: Version[]
  x: (version: Version) => unknown
}

const CASES = new URL('../core/parse/openapiEdgeCases.test.ts', import.meta.url)

const isVersion = (value: unknown): value is Version => VERSIONS.some(version => version === value)

const toEdgeCase = (value: unknown): EdgeCase => {
  if (!isRecord(value) || !Array.isArray(value.versions)) {
    throw new Error('a case has no `versions`')
  }

  const { name, rules, reading, versions, x } = value

  if (
    typeof name !== 'string' ||
    typeof rules !== 'string' ||
    typeof reading !== 'string' ||
    typeof x !== 'function'
  ) {
    throw new Error('a case has no `name`, `rules`, `reading` or `x`')
  }

  return { name, rules, reading, versions: versions.filter(isVersion), x: version => x(version) }
}

/** The cases of the test file, without the tests it makes of them. */
export const readEdgeCases = async (): Promise<EdgeCase[]> => {
  const source = await Deno.readTextFile(CASES)
  const [, body] = source.split(/^import .*parseBounded\.ts'$/m)
  const [cases, tests] = body?.split(/^for \(const \{ name, rules/m) ?? []

  if (cases === undefined || tests === undefined) {
    throw new Error('the test file of the edge cases has another form')
  }

  const module: unknown = await import(
    `data:application/typescript,${encodeURIComponent(`${cases}\nexport default cases`)}`
  )

  const list = isRecord(module) ? module.default : undefined

  if (!Array.isArray(list)) {
    throw new Error('the test file of the edge cases has no list of cases')
  }

  return list.map(toEdgeCase)
}

/** What a `rules` text says of a value. */
type ValueClaim = { value: unknown; valid: boolean }

export type Claim =
  /** Which values are valid. */
  | { type: 'values'; claims: ValueClaim[] }
  /** The document is not valid. */
  | { type: 'invalid' }
  /** What a keyword means, which a validator does not say: the reason. */
  | { type: 'no values'; reason: string }

const valid = (...values: unknown[]): ValueClaim[] => values.map(value => ({ value, valid: true }))
const notValid = (...values: unknown[]): ValueClaim[] =>
  values.map(value => ({ value, valid: false }))
const claims = (...all: ValueClaim[][]): Claim => ({ type: 'values', claims: all.flat() })

const nullIsNotValid = claims(notValid(null))

const isTarget = claims(valid({}, { a: 'a' }), notValid('a', null))

/** A value of X in a case where X holds the schema in its property `self`. */
const self = (value: unknown) => ({ self: value })

/** What each case's `rules` text says, by the case's name. */
export const CLAIMS: Record<string, Claim> = {
  'nullable beside an allOf of one ref to a schema that is not nullable': nullIsNotValid,
  'an allOf where only one member allows null': nullIsNotValid,
  'a type beside a kept ref to a schema that allows null': claims(notValid(self(null))),
  'a nullable type with an enum that does not list null': claims(valid('a'), notValid(null)),
  'an enum that lists null, with a type that does not allow it': claims(
    valid('a'),
    notValid(null, 'b')
  ),
  'an integer with an enum of strings': claims(notValid(1, 2, '1', '2', null)),
  'nullable beside a $ref': isTarget,
  'nullable beside a $ref, in a version without the keyword': isTarget,
  'nullable beside a type, in a version without the keyword': claims(valid('a'), notValid(null)),
  'a union member of type null, in a version without that type': { type: 'invalid' },
  'a list of types, in a version that takes one': { type: 'invalid' },
  'properties without a type': claims(valid('a', 1, null, { a: 'a' }), notValid({ a: 1 })),
  'properties without a type, in 3.1 and 3.2': claims(
    valid('a', 1, null, { a: 'a' }),
    notValid({ a: 1 })
  ),
  'items without a type': claims(valid('a', 1, null, ['a']), notValid([1])),
  'a string keyword without a type': claims(valid('a', 1, null, {}), notValid('b')),
  'required without a type or properties': claims(valid('a', 1, null, { a: 1 }), notValid({})),
  'required: true on a property': { type: 'invalid' },
  'a default that is a string, on a number': {
    type: 'no values',
    reason: 'a default does not change which values are valid'
  },
  'const, in a version without the keyword': claims(valid('a', 'b')),
  'a numeric exclusiveMinimum, in a version where it is a boolean': { type: 'invalid' },
  'additionalProperties: false beside an allOf that merges': claims(
    notValid({ a: 'a' }, { b: 'b' }),
    valid({})
  ),
  'additionalProperties: false beside an allOf that keeps a ref': claims(
    notValid({ x: {} }, { b: 'b' }),
    valid({})
  ),
  // "The target", which does not allow null: the nullable beside the ref adds nothing.
  'a type beside an allOf of one ref to a schema with that type': claims(
    valid(self({}), self(self({}))),
    notValid(self('a'), self(null))
  ),
  'a type beside an anyOf of one ref to a schema with that type': claims(
    valid(self({}), self(self({}))),
    notValid(self('a'), self(null))
  ),
  'a type beside an allOf of one ref to a schema that allows null': nullIsNotValid,
  'a type that narrows, beside an allOf of one ref': claims(valid(1), notValid(1.5, 'a', null))
}

const text = { type: 'string' }

/** The components the test file puts beside the case. */
const toSchemas = (version: Version, x: unknown): Record<string, unknown> => {
  const nullable =
    version === '3.0.3' ? { type: 'object', nullable: true } : { type: ['object', 'null'] }
  const X = { $ref: '#/components/schemas/X' }

  return {
    X: x,
    Obj: { type: 'object', properties: { a: text } },
    OrNull: { ...nullable, properties: { a: text } },
    Loop: { ...nullable, properties: { x: X } },
    Base: { type: 'object', properties: { x: X } },
    Num: { type: 'number' }
  }
}

export type CaseResult = {
  name: string
  version: Version
  rules: string
  claim: Claim
  answer: Answer
  /** What the version does not have or read, so the answer is without it. */
  ignored: string[]
  /** How the text and the answer differ. */
  differences: string[]
}

const toCaseDifferences = (claim: Claim, answer: Answer): string[] => {
  switch (claim.type) {
    case 'no values':
      return []
    case 'invalid':
      return answer.type === 'invalid'
        ? []
        : ['the text says that the schema is not valid; the validator reads it']
    case 'values': {
      if (answer.type === 'invalid') {
        return [
          `the text says which values are valid; the schema is not valid: ${answer.reasons.join(', ')}`
        ]
      }

      return claim.claims.flatMap(({ value, valid: isValid }, index) =>
        answer.accepted[index] === isValid
          ? []
          : [
              `${JSON.stringify(value)}: ${isValid ? 'valid' : 'not valid'} in the text, not so for the validator`
            ]
      )
    }
    default: {
      const unhandled: never = claim

      throw new Error(`unhandled claim: ${JSON.stringify(unhandled)}`)
    }
  }
}

export const toCaseResults = (cases: EdgeCase[]): CaseResult[] =>
  cases.flatMap(({ name, rules, versions, x }) =>
    versions.map(version => {
      const claim = CLAIMS[name]

      if (claim === undefined) {
        throw new Error(`no claim for the case "${name}"`)
      }

      const schemas = toSchemas(version, x(version))
      const values = claim.type === 'values' ? claim.claims.map(({ value }) => value) : []
      const answer = toRulesAnswer({ version, name: 'X', schemas, values })

      return {
        name,
        version,
        rules,
        claim,
        answer,
        ignored: translate(version, schemas.X).ignored,
        differences: toCaseDifferences(claim, answer)
      }
    })
  )

if (import.meta.main) {
  const results = toCaseResults(await readEdgeCases())

  for (const { name, version, differences, ignored, claim } of results) {
    const state =
      claim.type === 'no values'
        ? claim.reason
        : differences.length === 0
          ? 'agrees'
          : differences.join('; ')

    console.log(
      `${version} ${name}: ${state}${ignored.length === 0 ? '' : ` (ignored: ${ignored.join(', ')})`}`
    )
  }
}
