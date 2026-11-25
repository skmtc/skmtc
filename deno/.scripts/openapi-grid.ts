#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run=deno
/**
 * Where core's parse differs from the OpenAPI rules (#413): a grid of schemas
 * made from a keyword, the place of a `$ref`, the target and the version, with
 * the values that the rules accept (Ajv) and the values that core's result
 * accepts.
 *
 * Run from `deno/`: `deno run -A .scripts/openapi-grid.ts <output.json>`.
 *
 * Not in the grid, so a cell that agrees is not read as more than it is: two
 * keywords at one site, `pattern` and the other bounds, arrays and booleans,
 * a value that two members of a union accept, and the names and descriptions
 * inside the target.
 */

import { ANNOTATIONS, type Annotation, type CoreDocument, parseInProcess, translateCore } from './openapi-grid-core.ts'
import { type Answer, toRulesAnswer, translate, validate, type Version, VERSIONS } from './openapi-grid-rules.ts'
import { isRecord } from './api-surface.ts'

export type Kind = 'object' | 'union' | 'scalars' | 'string' | 'number'

export type Target = {
  name: string
  kind: Kind
  nullable: boolean
  alias: boolean
  cyclic: boolean
}

const target = (name: string, kind: Kind, fields: Partial<Target> = {}): Target => ({
  name,
  kind,
  nullable: false,
  alias: false,
  cyclic: false,
  ...fields
})

export const TARGETS: Target[] = [
  target('object', 'object'),
  target('object or null', 'object', { nullable: true }),
  target('alias of object', 'object', { alias: true }),
  target('alias of object or null', 'object', { alias: true, nullable: true }),
  target('object in a cycle', 'object', { cyclic: true }),
  target('object or null in a cycle', 'object', { cyclic: true, nullable: true }),
  target('union of objects', 'union'),
  target('union of objects or null', 'union', { nullable: true }),
  target('union of objects in a cycle', 'union', { cyclic: true }),
  target('union of string and number', 'scalars'),
  target('string', 'string'),
  target('string or null', 'string', { nullable: true }),
  target('number', 'number'),
  target('number or null', 'number', { nullable: true })
]

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const text = { type: 'string' }

/** The `type` that every value of the kind but null has. */
export const TYPES: Record<Kind, string | undefined> = {
  object: 'object',
  union: 'object',
  scalars: undefined,
  string: 'string',
  number: 'number'
}

/** A type that some values of the kind have. */
const NARROWER: Record<Kind, string | undefined> = {
  object: undefined,
  union: undefined,
  scalars: 'string',
  string: undefined,
  number: 'integer'
}

/** A value that each kind of target accepts. */
const VALID: Record<Kind, unknown> = { object: { b: 'b' }, union: { b: 'b' }, scalars: 'a', string: 'a', number: 5 }

const withNull = (version: Version, type: string) =>
  version === '3.0.3' ? { type, nullable: true } : { type: [type, 'null'] }

/** The values each cell is asked about. `a` is a property of the target, and `b` the one that the keywords name. */
export const VALUES = [null, {}, { a: 'a' }, { b: 'b' }, { b: 1 }, 'a', 'bbb', 1.5, 5]

/** What to call each of {@link VALUES}. */
export const VALUE_NAMES = ['null', '{}', '{a}', '{b}', '{b: 1}', '"a"', '"bbb"', '1.5', '5']

type Keyword = {
  name: string
  /** The keyword beside a ref to `target`; `undefined` when there is none to write. */
  toSchema: (version: Version, target: Target) => Record<string, unknown> | undefined
}

const same = (name: string, schema: Record<string, unknown>): Keyword => ({ name, toSchema: () => schema })

const typed = (
  name: string,
  toSchema: (type: string, version: Version, target: Target) => Record<string, unknown> | undefined
): Keyword => ({
  name,
  toSchema: (version, target) => {
    const type = TYPES[target.kind]

    return type === undefined ? undefined : toSchema(type, version, target)
  }
})

/** The cell with no keyword, so a difference that the spelling alone makes is not counted for each keyword. */
export const NO_KEYWORD = 'none'

export const KEYWORDS: Keyword[] = [
  same(NO_KEYWORD, {}),
  typed('type, the same', (type, _version, { nullable }) => (nullable ? undefined : { type })),
  typed("type, without the target's null", (type, _version, { nullable }) => (nullable ? { type } : undefined)),
  typed('type with nullable: false', type => ({ type, nullable: false })),
  typed('type with nullable: true', type => ({ type, nullable: true })),
  typed('type: [type, null]', type => ({ type: [type, 'null'] })),
  {
    name: 'type, narrower',
    toSchema: (_version, { kind }) => (NARROWER[kind] === undefined ? undefined : { type: NARROWER[kind] })
  },
  same('nullable: true', { nullable: true }),
  same('nullable: false', { nullable: false }),
  { name: 'enum', toSchema: (_version, { kind }) => ({ enum: [VALID[kind]] }) },
  { name: 'enum with null', toSchema: (_version, { kind }) => ({ enum: [VALID[kind], null] }) },
  { name: 'const', toSchema: (_version, { kind }) => ({ const: VALID[kind] }) },
  { name: 'default', toSchema: (_version, { kind }) => ({ default: VALID[kind] }) },
  same('default: null', { default: null }),
  same('required', { required: ['b'] }),
  same('properties', { properties: { b: text } }),
  same('additionalProperties: false', { additionalProperties: false }),
  same('minLength', { minLength: 2 }),
  same('minimum', { minimum: 2 }),
  { name: 'not', toSchema: (_version, { kind }) => ({ not: { enum: [VALID[kind]] } }) },
  same('readOnly', { readOnly: true }),
  same('deprecated', { deprecated: true }),
  same('description', { description: 'd' }),
  same('externalDocs', { externalDocs: { url: 'https://example.com' } })
]

type Spelling = {
  name: string
  /** Spellings of one family have the same members, so the same meaning. */
  family: 'one ref' | 'allOf of two' | 'union of two' | 'ref or null'
  toSchema: (keyword: Record<string, unknown>) => Record<string, unknown>
}

const TARGET = ref('Target')
const OTHER = ref('Other')
const NULL = { type: 'null' }

const beside = (name: string, family: Spelling['family'], schema: Record<string, unknown>): Spelling => ({
  name,
  family,
  toSchema: keyword => ({ ...schema, ...keyword })
})

export const SPELLINGS: Spelling[] = [
  beside('$ref', 'one ref', TARGET),
  beside('allOf [ref]', 'one ref', { allOf: [TARGET] }),
  { name: 'allOf [ref, {keyword}]', family: 'one ref', toSchema: keyword => ({ allOf: [TARGET, keyword] }) },
  beside('anyOf [ref]', 'one ref', { anyOf: [TARGET] }),
  beside('oneOf [ref]', 'one ref', { oneOf: [TARGET] }),
  beside('allOf [ref, ref]', 'allOf of two', { allOf: [TARGET, ref('Rest')] }),
  beside('anyOf [ref, ref]', 'union of two', { anyOf: [TARGET, OTHER] }),
  beside('oneOf [ref, ref]', 'union of two', { oneOf: [TARGET, OTHER] }),
  beside('anyOf [ref, null]', 'ref or null', { anyOf: [TARGET, NULL] }),
  beside('oneOf [ref, null]', 'ref or null', { oneOf: [TARGET, NULL] })
]

/** A schema of the target's kind that accepts none of {@link VALUES}, so a `oneOf` with it has no overlap. */
const OTHERS: Record<Kind, unknown> = {
  object: { type: 'object', required: ['z'], properties: { z: text } },
  union: { type: 'object', required: ['z'], properties: { z: text } },
  scalars: { type: 'string', minLength: 10 },
  string: { type: 'string', minLength: 10 },
  number: { type: 'number', minimum: 100 }
}

/** A schema that an `allOf` adds to the target, which accepts each value of the kind but null. */
const RESTS: Record<Kind, unknown> = {
  object: { type: 'object', properties: { c: text } },
  union: { type: 'object', properties: { c: text } },
  scalars: {},
  string: { type: 'string', maxLength: 50 },
  number: { type: 'number', maximum: 1000 }
}

/** The target's components. A target in a cycle has a property that is the cell, named `Cell`. */
const toTargetSchemas = (version: Version, { kind, nullable, alias, cyclic }: Target): Record<string, unknown> => {
  const typeOf = (type: string) => (nullable ? withNull(version, type) : { type })
  const properties = { a: text, ...(cyclic ? { x: ref('Cell') } : {}) }

  const toSchemas = (): Record<string, unknown> => {
    switch (kind) {
      case 'object':
        return { Base: { ...typeOf('object'), properties } }
      case 'union':
        return {
          Base: { oneOf: [ref('Left'), ref('Right')] },
          Left: { type: 'object', properties },
          Right: { ...typeOf('object'), required: ['c'], properties: { c: text } }
        }
      case 'scalars':
        return { Base: { oneOf: [text, { type: 'number' }] } }
      default:
        return { Base: typeOf(kind) }
    }
  }

  const { Base, ...others } = toSchemas()
  const base = alias ? { Base, Target: ref('Base') } : { Target: Base }

  return { ...base, ...others, Other: OTHERS[kind], Rest: RESTS[kind] }
}

export type Cell = {
  version: Version
  keyword: string
  spelling: string
  target: string
}

export type CellSchemas = {
  cell: Cell
  /** The cell, named `Cell`, and the components it refers to. */
  schemas: Record<string, unknown>
}

export const toCells = (): CellSchemas[] =>
  VERSIONS.flatMap(version =>
    TARGETS.flatMap(target =>
      KEYWORDS.flatMap(keyword => {
        const beside = keyword.toSchema(version, target)

        return beside === undefined
          ? []
          : SPELLINGS.map(spelling => ({
              cell: { version, keyword: keyword.name, spelling: spelling.name, target: target.name },
              schemas: { Cell: spelling.toSchema(beside), ...toTargetSchemas(version, target) }
            }))
      })
    )
  )

/** What core made of a cell: the values its result accepts, or why there are none to give. */
export type CoreAnswer = Answer | { type: 'removed' } | { type: 'no return' }

export type CellResult = {
  cell: Cell
  schema: unknown
  rules: Answer
  core: CoreAnswer
  /** The annotation that the cell's keyword is, and whether the rules and core have it at the site. */
  annotation: { name: Annotation; rules: boolean; core: boolean } | undefined
  /** What the cell parsed to: `ref`, `object`, `intersection`, … */
  form: string
  issues: string[]
}

/** The annotation among {@link ANNOTATIONS} that a keyword writes. */
export const toAnnotation = (keyword: string): Annotation | undefined =>
  ANNOTATIONS.find(annotation => keyword === annotation || keyword.startsWith(`${annotation}:`))

/** Whether a schema has the annotation, at the top or in an `allOf` member that every value matches. */
const hasRulesAnnotation = (schema: unknown, annotation: Annotation): boolean =>
  isRecord(schema) &&
  (annotation in schema ||
    (Array.isArray(schema.allOf) && schema.allOf.some(member => hasRulesAnnotation(member, annotation))))

/** The names of the components that a schema of core's refers to, through any others. */
const toReached = (name: string, schemas: CoreDocument['schemas'], reached: Set<string> = new Set()): Set<string> => {
  if (reached.has(name)) {
    return reached
  }

  reached.add(name)
  const names = JSON.stringify(schemas[name]?.json ?? {}).matchAll(/"\$ref":"#\/components\/schemas\/([^"/]+)"/g)

  for (const [, inner = ''] of names) {
    toReached(inner, schemas, reached)
  }

  return reached
}

type ToCoreAnswerArgs = { name: string; document: CoreDocument | undefined; values?: unknown[] }

/**
 * The values that core's result for a component accepts. A component that core
 * removed, or that refers to one, has no answer: it does not accept every value.
 */
export const toCoreAnswer = ({ name, document, values = VALUES }: ToCoreAnswerArgs): CoreAnswer => {
  if (document === undefined) {
    return { type: 'no return' }
  }

  const names = [...toReached(name, document.schemas)]

  if (names.some(reached => document.schemas[reached] === undefined)) {
    return { type: 'removed' }
  }

  return validate({
    name,
    schemas: Object.fromEntries(names.map(reached => [reached, translateCore(document.schemas[reached]?.json)])),
    values
  })
}

const toDocument = (version: Version, schemas: Record<string, unknown>) => ({
  openapi: version,
  info: { title: 't', version: '1' },
  paths: {},
  components: { schemas }
})

type ToResultArgs = { cellSchemas: CellSchemas; document: CoreDocument | undefined; name?: string }

const toResult = ({ cellSchemas: { cell, schemas }, document, name = 'Cell' }: ToResultArgs): CellResult => {
  const annotation = toAnnotation(cell.keyword)
  const parsed = document?.schemas[name]
  const { schema } = translate(cell.version, schemas.Cell)

  return {
    cell,
    schema: schemas.Cell,
    rules: toRulesAnswer({ version: cell.version, name: 'Cell', schemas, values: VALUES }),
    core: toCoreAnswer({ name, document }),
    annotation: annotation && {
      name: annotation,
      rules: hasRulesAnnotation(schema, annotation),
      core: parsed?.annotations.includes(annotation) ?? false
    },
    form: parsed?.form ?? 'none',
    issues: (document?.issues ?? []).filter(({ location }) => location.split(':').includes(name)).map(({ type }) => type)
  }
}

/** Runs `run` for each item, `limit` at a time. */
const mapLimited = async <Item, Result>(
  items: Item[],
  limit: number,
  run: (item: Item) => Promise<Result>
): Promise<Result[]> => {
  const results = new Map<number, Result>()
  const queue = items.entries()

  const work = async () => {
    for (const [index, item] of queue) {
      results.set(index, await run(item))
    }
  }

  await Promise.all(Array.from({ length: limit }, work))

  return items.flatMap((_item, index) => {
    const result = results.get(index)

    return result === undefined ? [] : [result]
  })
}

/** `value` with each `$ref` to a component named in `names` given its new name. */
const renameRefs = (value: unknown, names: Map<string, string>): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => renameRefs(item, names))
  }

  if (!isRecord(value)) {
    return value
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [
      key,
      key === '$ref' && typeof inner === 'string'
        ? (names.get(inner) ?? inner)
        : renameRefs(inner, names)
    ])
  )
}

/** One document with the components of each cell under names of its own. */
export const toSharedDocument = (version: Version, cells: CellSchemas[]) => {
  const components = cells.flatMap(({ schemas }, index) => {
    const names = new Map(
      Object.keys(schemas).map(name => [`#/components/schemas/${name}`, `#/components/schemas/${name}${index}`])
    )

    return Object.entries(schemas).map(([name, schema]) => [`${name}${index}`, renameRefs(schema, names)])
  })

  return toDocument(version, Object.fromEntries(components))
}

const isCyclic = ({ cell }: CellSchemas): boolean =>
  TARGETS.some(({ name, cyclic }) => cyclic && name === cell.target)

/** How many processes run at once. */
const PROCESSES = 8

/** How many cells share a document. */
const BATCH = 100

/**
 * The answers for each cell. The cells share documents, except those with a
 * target in a cycle: a parse of one that does not return would take the
 * others with it.
 */
export const toResults = async (cells: CellSchemas[]): Promise<CellResult[]> => {
  const batches = VERSIONS.flatMap(version => {
    const shared = cells.filter(item => item.cell.version === version && !isCyclic(item))
    const count = Math.ceil(shared.length / BATCH)

    return Array.from({ length: count }, (_, index) => shared.slice(index * BATCH, (index + 1) * BATCH))
  })

  const sharedResults = await mapLimited(batches, PROCESSES, async batch => {
    const [first] = batch
    const document = first && (await parseInProcess({ document: toSharedDocument(first.cell.version, batch) }))

    return batch.map((cellSchemas, index) => toResult({ cellSchemas, document, name: `Cell${index}` }))
  })

  const ownResults = await mapLimited(cells.filter(isCyclic), PROCESSES, async cellSchemas => {
    const document = await parseInProcess({ document: toDocument(cellSchemas.cell.version, cellSchemas.schemas) })

    return toResult({ cellSchemas, document })
  })

  return [...sharedResults.flat(), ...ownResults]
}

/** The values on which two answers differ, as the names of those core accepts (`+`) and refuses (`-`) against the rules. */
export const toDifference = ({ rules, core, annotation }: CellResult): string | undefined => {
  if (rules.type === 'invalid') {
    return undefined
  }

  if (core.type !== 'values') {
    return core.type
  }

  const differences = VALUE_NAMES.flatMap((name, index) => {
    const [expected, actual] = [rules.accepted[index], core.accepted[index]]

    return expected === actual ? [] : [`${actual ? '+' : '-'}${name}`]
  })

  const annotations =
    annotation === undefined || annotation.rules === annotation.core
      ? []
      : [annotation.core ? `has ${annotation.name}` : `no ${annotation.name}`]

  const all = [...differences, ...annotations]

  return all.length === 0 ? undefined : all.join(' ')
}

/** What a cell's two sides say, as one string each, to compare cells with. */
export const toSides = ({ rules, core, annotation }: CellResult) => ({
  rules: rules.type === 'invalid' ? undefined : JSON.stringify([rules.accepted, annotation?.rules]),
  core: JSON.stringify([core.type === 'values' ? core.accepted : core.type, annotation?.core])
})

/** The cells of one keyword, target, version and family that the rules give one answer, where core gives more than one. */
export const toSpellingDifferences = (results: CellResult[], of: (result: CellResult) => string): CellResult[][] => {
  const groups = Map.groupBy(
    results.filter(({ rules }) => rules.type === 'values'),
    result => {
      const { version, keyword, target, spelling } = result.cell
      const family = SPELLINGS.find(({ name }) => name === spelling)?.family

      return JSON.stringify([version, keyword, target, family, toSides(result).rules])
    }
  )

  return [...groups.values()].filter(group => new Set(group.map(of)).size > 1)
}

export const toSummary = (results: CellResult[]) => {
  const differences = results.map(toDifference)
  const isOnlyAnnotation = (difference: string) => /^(has|no) (?!return)/.test(difference)
  const disagreeing = differences.filter(difference => difference !== undefined)

  return {
    cells: results.length,
    noRulesAnswer: results.filter(({ rules }) => rules.type === 'invalid').length,
    agreeing: results.length - disagreeing.length - results.filter(({ rules }) => rules.type === 'invalid').length,
    disagreeing: disagreeing.length,
    removed: disagreeing.filter(difference => difference === 'removed').length,
    noReturn: disagreeing.filter(difference => difference === 'no return').length,
    onlyAnnotation: disagreeing.filter(isOnlyAnnotation).length,
    sameBySpelling: {
      groups: toSpellingDifferences(results, result => toSides(result).core).length,
      cells: toSpellingDifferences(results, result => toSides(result).core).flat().length,
      groupsOfFormOnly: toSpellingDifferences(results, ({ form }) => form).filter(
        group => new Set(group.map(result => toSides(result).core)).size === 1
      ).length
    }
  }
}

if (import.meta.main) {
  const [output] = Deno.args

  if (output === undefined) {
    console.error('Usage: openapi-grid.ts <output.json>')
    Deno.exit(1)
  }

  const results = await toResults(toCells())

  Deno.writeTextFileSync(output, JSON.stringify(results))
  console.log(JSON.stringify(toSummary(results), undefined, 2))
}
