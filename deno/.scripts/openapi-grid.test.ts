import { assert, assertEquals } from '@std/assert'
import {
  type CellResult,
  toCells,
  toCoreAnswer,
  toDifferences,
  toResults,
  toSharedDocument,
  toSummary,
  VALUE_NAMES
} from './openapi-grid.ts'
import { parseInProcess } from './openapi-grid-core.ts'
import { toRulesAnswer, translate30, translate31, type Version } from './openapi-grid-rules.ts'
import { toCaseResults } from './openapi-grid-cases.ts'
import { toGroups, toTable } from './openapi-grid-report.ts'

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

/** The values of the grid that an answer accepts, by name. */
const toAccepted = (answer: CellResult['core']): string[] | string =>
  answer.type === 'values'
    ? VALUE_NAMES.filter((_name, index) => answer.accepted[index])
    : answer.type

const runCell = async (
  version: Version,
  keyword: string,
  spelling: string,
  target: string
): Promise<CellResult> => {
  const cells = toCells().filter(
    ({ cell }) =>
      cell.version === version &&
      cell.keyword === keyword &&
      cell.spelling === spelling &&
      cell.target === target
  )
  const [result] = await toResults(cells)

  assert(result !== undefined && cells.length === 1)

  return result
}

Deno.test('3.0: nullable adds null to the type in the same schema only', () => {
  assertEquals(translate30({ type: 'string', nullable: true }).schema, { type: ['string', 'null'] })
  assertEquals(translate30({ type: 'string', nullable: false }).schema, { type: 'string' })
  assertEquals(translate30({ nullable: true, allOf: [ref('A')] }).schema, {
    allOf: [{ $ref: '#/$defs/A' }]
  })
})

Deno.test('3.0: nullable does not add null to the enum', () => {
  assertEquals(translate30({ type: 'string', nullable: true, enum: ['a'] }).schema, {
    type: ['string', 'null'],
    enum: ['a']
  })
})

Deno.test('3.0: keywords beside a $ref are ignored, also inside another schema', () => {
  assertEquals(
    translate30({
      type: 'object',
      properties: { a: { ...ref('A'), nullable: true, description: 'd' } }
    }),
    {
      schema: { type: 'object', properties: { a: { $ref: '#/$defs/A' } } },
      invalid: [],
      ignored: ['nullable', 'description']
    }
  )
})

Deno.test('3.0: a boolean exclusiveMinimum takes its number from minimum', () => {
  assertEquals(translate30({ type: 'number', minimum: 1, exclusiveMinimum: true }).schema, {
    type: 'number',
    exclusiveMinimum: 1
  })
  assertEquals(translate30({ type: 'number', minimum: 1, exclusiveMinimum: false }).schema, {
    type: 'number',
    minimum: 1
  })
})

Deno.test('3.0: what the version does not allow is named', () => {
  assertEquals(translate30({ type: ['string', 'null'] }).invalid, ['type: ["string","null"]'])
  assertEquals(translate30({ oneOf: [ref('A'), { type: 'null' }] }).invalid, ['type: "null"'])
  assertEquals(translate30({ type: 'number', exclusiveMinimum: 1 }).invalid, [
    'exclusiveMinimum is not a boolean'
  ])
  assertEquals(translate30({ type: 'string', required: true }).invalid, ['required is not a list'])
})

Deno.test('3.0: a keyword that the version does not have is left out, and an extension is not', () => {
  const { schema, ignored } = translate30({ type: 'string', const: 'a', 'x-a': 1 })

  assertEquals(schema, { type: 'string' })
  assertEquals(ignored, ['const'])
})

Deno.test('3.0: a property may have the name of a keyword, and data is no schema', () => {
  const schema = {
    type: 'object',
    properties: { nullable: { type: 'string' }, const: { type: 'string' } },
    default: { type: 'string', nullable: true, $ref: 'x' }
  }

  assertEquals(translate30(schema), { schema, invalid: [], ignored: [] })
})

Deno.test('3.1: nullable is no keyword, so the validator does not read it', () => {
  assertEquals(translate31({ type: 'string', nullable: true }), {
    schema: { type: 'string' },
    invalid: [],
    ignored: ['nullable']
  })
  assertEquals(
    toRulesAnswer({
      version: '3.1.0',
      name: 'A',
      schemas: { A: { type: 'string', nullable: true } },
      values: [null, 'a']
    }),
    { type: 'values', accepted: [false, true] }
  )
})

Deno.test('3.1: keywords beside a $ref are read', () => {
  assertEquals(
    toRulesAnswer({
      version: '3.1.0',
      name: 'A',
      schemas: { A: { ...ref('B'), minLength: 2 }, B: { type: 'string' } },
      values: ['a', 'bbb']
    }),
    { type: 'values', accepted: [false, true] }
  )
})

Deno.test('a schema that is not valid has no rules answer', () => {
  const toAnswer = (version: Version, schema: unknown) =>
    toRulesAnswer({ version, name: 'A', schemas: { A: schema }, values: [null] }).type

  assertEquals(toAnswer('3.0.3', { type: ['string', 'null'] }), 'invalid')
  assertEquals(toAnswer('3.1.0', { type: ['string', 'null'] }), 'values')
  assertEquals(toAnswer('3.1.0', { required: true }), 'invalid')
})

Deno.test('a cell that agrees: an object that says nothing of other properties is open', async () => {
  const result = await runCell('3.0.3', 'required', 'allOf [ref]', 'object')

  assertEquals(toAccepted(result.core), ['{b}', '{b: 1}'])
  assertEquals(result.rules, result.core)
  assertEquals(toDifferences(result), [])
})

Deno.test('a cell where core accepts null and the rules do not', async () => {
  const result = await runCell('3.0.3', 'nullable: true', 'allOf [ref]', 'string')

  assertEquals(toAccepted(result.rules), ['"a"', '"bbb"'])
  assertEquals(toAccepted(result.core), ['null', '"a"', '"bbb"'])
  assertEquals(toDifferences(result), ['null accepted'])
})

Deno.test('a cell where core accepts values that the rules refuse', async () => {
  const result = await runCell('3.1.0', 'additionalProperties: false', 'allOf [ref, ref]', 'object')

  assertEquals(toAccepted(result.rules), ['{}'])
  assertEquals(toAccepted(result.core), ['{}', '{a}'])
  assertEquals(toDifferences(result), ['values accepted'])
})

Deno.test('a type that excludes the null of the target: the rules refuse null', async () => {
  const result = await runCell(
    '3.0.3',
    'type with nullable: false',
    'allOf [ref]',
    'string or null'
  )

  assertEquals(toAccepted(result.rules), ['"a"', '"bbb"'])
})

Deno.test('a cell in a cycle', async () => {
  const result = await runCell('3.0.3', 'description', 'allOf [ref]', 'object in a cycle')

  assertEquals(result.form, 'ref')
  assertEquals(toDifferences(result), [])
})

Deno.test('a keyword beside a kept ref is read as core resolves it', async () => {
  const result = await runCell('3.0.3', 'enum', 'allOf [ref]', 'string or null')

  // A nullable string with an enum: core reads null as valid, whether it is listed or not.
  assertEquals(toAccepted(result.core), ['null', '"a"'])
  assertEquals(result.form, 'ref')
})

Deno.test('each way to differ has its name', () => {
  const cell = {
    version: '3.1.0' as const,
    keyword: 'description',
    spelling: 'allOf [ref]',
    target: 'object'
  }
  const toResult = (fields: Partial<CellResult>): CellResult => ({
    cell,
    schema: {},
    rules: { type: 'values', accepted: [true, true] },
    core: { type: 'values', accepted: [true, true] },
    annotation: undefined,
    form: 'ref',
    issues: [],
    ...fields
  })
  const toAnnotated = (rules: boolean, core: boolean, valid = true) =>
    toDifferences(toResult({ annotation: { name: 'default', rules, core, valid } }))

  assertEquals(toDifferences(toResult({})), [])
  // The values of the grid start with null.
  assertEquals(toDifferences(toResult({ core: { type: 'values', accepted: [false, true] } })), [
    'null refused'
  ])
  assertEquals(toDifferences(toResult({ core: { type: 'values', accepted: [true, false] } })), [
    'values refused'
  ])
  assertEquals(toDifferences(toResult({ core: { type: 'no return' } })), ['no return'])
  assertEquals(toAnnotated(true, false), ['annotation lost'])
  assertEquals(toAnnotated(true, false, false), ['default that is not valid lost'])
  assertEquals(toAnnotated(false, true), ['annotation kept'])
  assertEquals(toAnnotated(true, true), [])
})

Deno.test('an annotation beside a $ref is at the site in 3.1 and not in 3.0', async () => {
  const before = await runCell('3.0.3', 'description', '$ref', 'object')
  const after = await runCell('3.1.0', 'description', '$ref', 'object')

  assertEquals([before.annotation?.rules, before.annotation?.core], [false, false])
  assertEquals([after.annotation?.rules, after.annotation?.core], [true, true])
})

Deno.test('a default that the rules refuse is told from one that is lost', async () => {
  const refused = await runCell('3.1.0', 'default: null', 'allOf [ref]', 'string')
  const accepted = await runCell('3.1.0', 'default: null', 'anyOf [ref, null]', 'string')

  assertEquals([refused.annotation?.rules, refused.annotation?.valid], [true, false])
  assertEquals([accepted.annotation?.rules, accepted.annotation?.valid], [true, true])
})

Deno.test('a cell that core removes has no values', async () => {
  const result = await runCell('3.1.0', 'not', 'allOf [ref]', 'object')

  assertEquals(result.core, { type: 'removed' })
  assertEquals(toDifferences(result), ['removed'])
  assertEquals(result.issues, ['INVALID_SCHEMA'])
})

Deno.test('a cell that the rules give no answer does not differ', async () => {
  const result = await runCell('3.0.3', 'type: [type, null]', 'allOf [ref]', 'object')

  assertEquals(result.rules.type, 'invalid')
  assertEquals(toDifferences(result), [])
})

Deno.test('a $ref that core removed as dangling does not accept every value', async () => {
  const document = await parseInProcess({
    document: {
      openapi: '3.1.0',
      info: { title: 't', version: '1' },
      paths: {},
      components: {
        schemas: { A: ref('Missing'), B: { type: 'object', properties: { a: ref('A') } } }
      }
    }
  })

  assertEquals(toCoreAnswer({ name: 'A', document }), { type: 'removed' })
  assertEquals(toCoreAnswer({ name: 'B', document }), { type: 'removed' })
})

Deno.test('a parse that does not return in time has no answer', async () => {
  const document = await parseInProcess({ document: {}, timeout: 1 })

  assertEquals(document, undefined)
  assertEquals(toCoreAnswer({ name: 'A', document }), { type: 'no return' })
})

Deno.test('cells that share a document do not refer to the components of another', () => {
  const cells = toCells()
    .filter(({ cell }) => cell.keyword === 'none' && cell.spelling === 'allOf [ref, ref]')
    .slice(0, 2)
  const { schemas } = toSharedDocument('3.0.3', cells).components

  assertEquals(schemas.Cell1, { allOf: [ref('Target1'), ref('Rest1')] })
})

Deno.test('the summary and the groups count a difference of the spelling once', async () => {
  const cells = toCells().filter(
    ({ cell }) =>
      cell.version === '3.1.0' &&
      cell.target === 'object or null' &&
      ['allOf [ref, ref]', 'allOf [ref]'].includes(cell.spelling) &&
      ['none', 'required', 'nullable: true'].includes(cell.keyword)
  )
  const results = await toResults(cells)
  const summary = toSummary(results)

  assertEquals([summary.cells, summary.agree, summary.disagreeInValues], [6, 3, 3])

  const cell = {
    version: '3.1.0' as const,
    keyword: 'none',
    spelling: 'allOf [ref, ref]',
    target: 'object or null'
  }
  const groups = toGroups(results, {
    documents: 1,
    sites: 2,
    cells: [{ cell, sites: 2, alone: 2, documents: ['a.json'], nullableInCore: 0, examples: [] }],
    outside: {}
  })

  assertEquals(
    groups.map(({ keyword, difference, sites }) => ({ keyword, difference, sites })),
    [{ keyword: 'none', difference: 'null accepted', sites: 2 }]
  )
  assert(
    toTable(groups).includes('| `none` | null is not valid | null is valid | 1 (2, alone 2) |')
  )
})

Deno.test('the text of a case is compared with the answer of the validator', () => {
  const name = 'a nullable type with an enum that does not list null'
  const toCase = (version: Version, schema: unknown) =>
    toCaseResults([
      { name, rules: '', reading: 'practice', versions: [version], x: () => schema }
    ])[0]?.differences

  assertEquals(toCase('3.0.3', { type: 'string', nullable: true, enum: ['a'] }), [])
  assertEquals(toCase('3.0.3', { type: 'string', nullable: true, enum: ['a', null] }), [
    'null: not valid in the text, not so for the validator'
  ])
})
