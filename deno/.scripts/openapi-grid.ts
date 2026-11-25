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

import {
  ANNOTATIONS,
  type Annotation,
  type CoreDocument,
  parseInProcess,
  translateCore
} from './openapi-grid-core.ts'
import {
  type Answer,
  toRulesAnswer,
  translate,
  validate,
  type Version,
  VERSIONS
} from './openapi-grid-rules.ts'
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
const VALID: Record<Kind, unknown> = {
  object: { b: 'b' },
  union: { b: 'b' },
  scalars: 'a',
  string: 'a',
  number: 5
}

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

const same = (name: string, schema: Record<string, unknown>): Keyword => ({
  name,
  toSchema: () => schema
})

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
  typed("type, without the target's null", (type, _version, { nullable }) =>
    nullable ? { type } : undefined
  ),
  typed('type with nullable: false', type => ({ type, nullable: false })),
  typed('type with nullable: true', type => ({ type, nullable: true })),
  typed('type: [type, null]', type => ({ type: [type, 'null'] })),
  {
    name: 'type, narrower',
    toSchema: (_version, { kind }) =>
      NARROWER[kind] === undefined ? undefined : { type: NARROWER[kind] }
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
  toSchema: (keyword: Record<string, unknown>, version: Version) => Record<string, unknown>
}

const TARGET = ref('Target')
const OTHER = ref('Other')

/** A member that is null only, as the version writes it: 3.0 has no type `null` (#398). */
const toNullMember = (version: Version) =>
  version === '3.0.3' ? { nullable: true, enum: [null] } : { type: 'null' }

const orNull = (group: 'anyOf' | 'oneOf'): Spelling => ({
  name: `${group} [ref, null]`,
  family: 'ref or null',
  toSchema: (keyword, version) => ({ [group]: [TARGET, toNullMember(version)], ...keyword })
})

const beside = (
  name: string,
  family: Spelling['family'],
  schema: Record<string, unknown>
): Spelling => ({
  name,
  family,
  toSchema: keyword => ({ ...schema, ...keyword })
})

export const SPELLINGS: Spelling[] = [
  beside('$ref', 'one ref', TARGET),
  beside('allOf [ref]', 'one ref', { allOf: [TARGET] }),
  {
    name: 'allOf [ref, {keyword}]',
    family: 'one ref',
    toSchema: keyword => ({ allOf: [TARGET, keyword] })
  },
  beside('anyOf [ref]', 'one ref', { anyOf: [TARGET] }),
  beside('oneOf [ref]', 'one ref', { oneOf: [TARGET] }),
  beside('allOf [ref, ref]', 'allOf of two', { allOf: [TARGET, ref('Rest')] }),
  beside('anyOf [ref, ref]', 'union of two', { anyOf: [TARGET, OTHER] }),
  beside('oneOf [ref, ref]', 'union of two', { oneOf: [TARGET, OTHER] }),
  orNull('anyOf'),
  orNull('oneOf')
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
const toTargetSchemas = (
  version: Version,
  { kind, nullable, alias, cyclic }: Target
): Record<string, unknown> => {
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
              cell: {
                version,
                keyword: keyword.name,
                spelling: spelling.name,
                target: target.name
              },
              schemas: {
                Cell: spelling.toSchema(beside, version),
                ...toTargetSchemas(version, target)
              }
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
  annotation: { name: Annotation; rules: boolean; core: boolean; valid: boolean } | undefined
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
    (Array.isArray(schema.allOf) &&
      schema.allOf.some(member => hasRulesAnnotation(member, annotation))))

/** The names of the components that a schema of core's refers to, through any others. */
const toReached = (
  name: string,
  schemas: CoreDocument['schemas'],
  reached: Set<string> = new Set()
): Set<string> => {
  if (reached.has(name)) {
    return reached
  }

  reached.add(name)
  const names = JSON.stringify(schemas[name]?.json ?? {}).matchAll(
    /"\$ref":"#\/components\/schemas\/([^"/]+)"/g
  )

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
    schemas: Object.fromEntries(
      names.map(reached => [reached, translateCore(document.schemas[reached]?.json)])
    ),
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

/** Whether the rules accept the `default` of a cell. Each default of the grid is one of {@link VALUES}. */
const isDefaultValid = ({ cell }: CellSchemas, rules: Answer): boolean => {
  const kind = TARGETS.find(({ name }) => name === cell.target)?.kind
  const value = JSON.stringify(
    cell.keyword === 'default: null' || kind === undefined ? null : VALID[kind]
  )

  return (
    rules.type === 'values' &&
    rules.accepted[VALUES.findIndex(item => JSON.stringify(item) === value)] === true
  )
}

const toResult = ({ cellSchemas, document, name = 'Cell' }: ToResultArgs): CellResult => {
  const { cell, schemas } = cellSchemas
  const annotation = toAnnotation(cell.keyword)
  const parsed = document?.schemas[name]
  const { schema } = translate(cell.version, schemas.Cell)
  const rules = toRulesAnswer({ version: cell.version, name: 'Cell', schemas, values: VALUES })

  return {
    cell,
    schema: schemas.Cell,
    rules,
    core: toCoreAnswer({ name, document }),
    annotation: annotation && {
      name: annotation,
      rules: hasRulesAnnotation(schema, annotation),
      core: parsed?.annotations.includes(annotation) ?? false,
      valid: annotation !== 'default' || isDefaultValid(cellSchemas, rules)
    },
    form: parsed?.form ?? 'none',
    issues: (document?.issues ?? [])
      .filter(({ location }) => location.split(':').includes(name))
      .map(({ type }) => type)
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
      Object.keys(schemas).map(name => [
        `#/components/schemas/${name}`,
        `#/components/schemas/${name}${index}`
      ])
    )

    return Object.entries(schemas).map(([name, schema]) => [
      `${name}${index}`,
      renameRefs(schema, names)
    ])
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

    return Array.from({ length: count }, (_, index) =>
      shared.slice(index * BATCH, (index + 1) * BATCH)
    )
  })

  const sharedResults = await mapLimited(batches, PROCESSES, async batch => {
    const [first] = batch
    const document =
      first && (await parseInProcess({ document: toSharedDocument(first.cell.version, batch) }))

    return batch.map((cellSchemas, index) =>
      toResult({ cellSchemas, document, name: `Cell${index}` })
    )
  })

  const ownResults = await mapLimited(cells.filter(isCyclic), PROCESSES, async cellSchemas => {
    const document = await parseInProcess({
      document: toDocument(cellSchemas.cell.version, cellSchemas.schemas)
    })

    return toResult({ cellSchemas, document })
  })

  return [...sharedResults.flat(), ...ownResults]
}

/** How core's answer for a cell differs from that of the rules. */
export type Difference =
  | 'null accepted'
  | 'null refused'
  | 'values accepted'
  | 'values refused'
  | 'removed'
  | 'no return'
  | 'annotation lost'
  | 'default that is not valid lost'
  | 'annotation kept'

/** The differences that a validator cannot show. */
const OF_ANNOTATIONS: Difference[] = [
  'annotation lost',
  'default that is not valid lost',
  'annotation kept'
]

export const isOfValues = (difference: Difference): boolean => !OF_ANNOTATIONS.includes(difference)

const toAnnotationDifference = ({ annotation }: CellResult): Difference[] => {
  if (annotation === undefined || annotation.rules === annotation.core) {
    return []
  }

  if (annotation.core) {
    return ['annotation kept']
  }

  return [annotation.valid ? 'annotation lost' : 'default that is not valid lost']
}

/** How a cell differs; empty when it agrees, or when the rules give no answer. */
export const toDifferences = (result: CellResult): Difference[] => {
  const { rules, core } = result

  if (rules.type === 'invalid') {
    return []
  }

  if (core.type === 'invalid') {
    throw new Error(`what core wrote is not a schema: ${core.reasons.join(', ')}`)
  }

  if (core.type !== 'values') {
    return [core.type]
  }

  const ofValues = VALUES.flatMap((value, index): Difference[] => {
    const [expected, actual] = [rules.accepted[index], core.accepted[index]]

    if (expected === actual) {
      return []
    }

    if (value === null) {
      return [actual ? 'null accepted' : 'null refused']
    }

    return [actual ? 'values accepted' : 'values refused']
  })

  return [...new Set([...ofValues, ...toAnnotationDifference(result)])]
}

type Side = (result: CellResult) => string

/** The values core accepts at a cell. */
const toCoreValues: Side = ({ core }) =>
  JSON.stringify(core.type === 'values' ? core.accepted : core.type)

/** The values core accepts at a cell, and whether it has the cell's annotation. */
const toCoreSide: Side = result => JSON.stringify([toCoreValues(result), result.annotation?.core])

/**
 * The cells of one keyword, target, version and family that the rules give one
 * answer, so that their spellings are the same schema.
 */
export const toSameSchemas = (results: CellResult[]): CellResult[][] => {
  const groups = Map.groupBy(
    results.filter(({ rules }) => rules.type === 'values'),
    ({ cell: { version, keyword, target, spelling }, rules, annotation }) => {
      const family = SPELLINGS.find(({ name }) => name === spelling)?.family

      return JSON.stringify([version, keyword, target, family, rules, annotation?.rules])
    }
  )

  return [...groups.values()].filter(group => group.length > 1)
}

const isSame = (group: CellResult[], of: Side): boolean => new Set(group.map(of)).size === 1

export const toSummary = (results: CellResult[]) => {
  const answered = results.filter(({ rules }) => rules.type === 'values')
  const differing = answered.map(toDifferences).filter(differences => differences.length > 0)
  const ofValues = differing.filter(differences => differences.some(isOfValues))
  const sameSchemas = toSameSchemas(results)
  const bySide = sameSchemas.filter(group => !isSame(group, toCoreSide))

  return {
    cells: results.length,
    noRulesAnswer: results.length - answered.length,
    agree: answered.length - differing.length,
    disagreeInValues: ofValues.length,
    removed: ofValues.filter(differences => differences.includes('removed')).length,
    noReturn: ofValues.filter(differences => differences.includes('no return')).length,
    disagreeInAnnotationOnly: differing.length - ofValues.length,
    spellings: {
      sameSchemas: sameSchemas.length,
      differInValues: bySide.filter(group => !isSame(group, toCoreValues)).length,
      differInAnnotationOnly: bySide.filter(group => isSame(group, toCoreValues)).length,
      differInFormOnly: sameSchemas.filter(
        group => isSame(group, toCoreSide) && !isSame(group, ({ form }) => form)
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
