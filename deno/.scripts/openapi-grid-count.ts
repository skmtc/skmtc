#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env
/**
 * How many API documents, and sites in them, have each cell of the grid in
 * `openapi-grid.ts`, from the raw documents.
 *
 * Run from `deno/`: `deno run -A .scripts/openapi-grid-count.ts <documents> <output.json>`,
 * where `<documents>` is a directory, read with those inside it.
 *
 * A site is a schema with a `$ref` in it: a `$ref` with keywords beside it, or
 * an `allOf`, `anyOf` or `oneOf` with a `$ref` member. A site counts once for
 * each grid keyword it has, so a site with two keywords is in two cells, and
 * neither cell says what the two do together. `alone` counts the sites with no
 * other keyword that changes values.
 *
 * A target is the kind that the raw document says it is. A nullable target is
 * one that core reads as nullable, so `nullable: true` counts in every version.
 */

import { join, relative, SEPARATOR } from '@std/path'
import { walk } from '@std/fs'
import { toCyclicRefs } from '../core/parse/toCyclicRefs.ts'
import { isRecord } from './api-surface.ts'
import { type Cell, type Kind, type Target, TARGETS, toAnnotation, TYPES } from './openapi-grid.ts'
import type { Version } from './openapi-grid-rules.ts'

/** Keywords whose value is data, so nothing in it is a schema. */
const DATA = ['default', 'example', 'examples', 'enum', 'const']

/** Keywords whose value is a map, so a name in it is not a keyword. */
const MAPS = [
  'properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas',
  // Maps of the document, where `default` or `x-rate-limit` is a name too.
  'responses', 'schemas', 'headers', 'parameters', 'requestBodies', 'content', 'paths', 'callbacks', 'webhooks'
]

export type Visit = { pointer: string; value: Record<string, unknown> }

/** Each object of a raw document that may be a schema, with its JSON pointer. */
export const toObjects = (value: unknown, pointer = '#', isMap = false): Visit[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => toObjects(item, `${pointer}/${index}`))
  }

  if (!isRecord(value)) {
    return []
  }

  const nested = Object.entries(value).flatMap(([key, inner]) =>
    !isMap && (DATA.includes(key) || key.startsWith('x-'))
      ? []
      : toObjects(inner, `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`, !isMap && MAPS.includes(key))
  )

  return isMap ? nested : [{ pointer, value }, ...nested]
}

const toVersion = (openapi: unknown): Version | undefined => {
  if (typeof openapi !== 'string') {
    return undefined
  }

  const versions: Record<string, Version> = { '3.0': '3.0.3', '3.1': '3.1.0', '3.2': '3.2.0' }

  return versions[openapi.split('.').slice(0, 2).join('.')]
}

type Ref = { $ref: string }

const isRef = (value: unknown): value is Ref => isRecord(value) && typeof value.$ref === 'string'

const isNullMember = (value: unknown): boolean =>
  isRecord(value) && (value.type === 'null' || (Array.isArray(value.enum) && value.enum.every(item => item === null)))

const decode = (part: string): string => {
  try {
    return decodeURIComponent(part)
  } catch {
    return part
  }
}

/** What a local `$ref` names in the raw document. */
const toRefTarget = (document: unknown, { $ref }: Ref): unknown =>
  $ref.startsWith('#/')
    ? $ref
        .slice(2)
        .split('/')
        .map(part => decode(part).replaceAll('~1', '/').replaceAll('~0', '~'))
        .reduce(
          (parent: unknown, part) =>
            isRecord(parent) ? parent[part] : Array.isArray(parent) ? parent[Number(part)] : undefined,
          document
        )
    : undefined

/** A `$ref` into a kind of component other than schemas names no schema. */
const canNameSchema = ({ $ref }: Ref): boolean =>
  !$ref.startsWith('#/components/') || $ref.startsWith('#/components/schemas/') || $ref.includes('/schema')

type RawTarget = {
  kind: Kind | 'other'
  type: string | undefined
  /** The target says that null is valid, and the rules accept it. */
  nullable: boolean
  /** Core reads the target as nullable: also `nullable: true` in 3.1, or with an `enum` that does not list null. */
  nullableInCore: boolean
  alias: boolean
}

/** How many schemas deep a target is read: enough for every chain, and a loop ends. */
const DEPTH = 12

const toDeclaredType = (schema: Record<string, unknown>): string | undefined => {
  const types = (Array.isArray(schema.type) ? schema.type : [schema.type]).filter(type => type !== 'null')

  if (types.length === 1 && typeof types[0] === 'string') {
    return types[0]
  }

  if (types.length > 0 && types[0] !== undefined) {
    return undefined
  }

  if (isRecord(schema.properties)) {
    return 'object'
  }

  return Array.isArray(schema.enum) && schema.enum.some(item => typeof item === 'string') ? 'string' : undefined
}

const toScalarKind = (type: string | undefined): Kind | 'other' => {
  switch (type) {
    case 'object':
    case 'string':
    case 'number':
      return type
    case 'integer':
      return 'number'
    default:
      return 'other'
  }
}

/** Whether the schema itself says that null is valid, and nothing in it but its members says otherwise. */
const declaresNull = (version: Version, { type, nullable, enum: enums }: Record<string, unknown>): boolean => {
  const inType = version === '3.0.3' ? typeof type === 'string' && nullable === true : Array.isArray(type) && type.includes('null')

  return inType && (!Array.isArray(enums) || enums.includes(null))
}

type ToRawTargetArgs = { version: Version; document: unknown; schema: unknown; depth?: number }

/** What a target is, read through its refs. */
export const toRawTarget = ({ version, document, schema, depth = 0 }: ToRawTargetArgs): RawTarget => {
  const none: RawTarget = { kind: 'other', type: undefined, nullable: false, nullableInCore: false, alias: false }

  if (!isRecord(schema) || depth > DEPTH) {
    return none
  }

  const toInner = (inner: unknown) => toRawTarget({ version, document, schema: inner, depth: depth + 1 })

  if (isRef(schema)) {
    return { ...toInner(toRefTarget(document, schema)), alias: true }
  }

  const type = toDeclaredType(schema)
  const nullable = declaresNull(version, schema)
  const nullableInCore = nullable || schema.nullable === true
  // A type beside members excludes their null, unless it has null too.
  const isOpen = schema.type === undefined || nullable
  const members = schema.oneOf ?? schema.anyOf

  if (Array.isArray(members)) {
    const inner = members.filter(member => !isNullMember(member)).map(toInner)
    const hasNullMember = members.some(isNullMember)
    const [only] = inner
    const isOf = (allowed: (Kind | 'other')[]) => inner.length > 0 && inner.every(({ kind }) => allowed.includes(kind))

    const union: RawTarget = {
      ...none,
      nullable: isOpen && (hasNullMember || inner.some(member => member.nullable)),
      nullableInCore: nullableInCore || hasNullMember || inner.some(member => member.nullableInCore)
    }

    if (inner.length === 1 && only !== undefined) {
      const isAlias = isRef(members.find(member => !isNullMember(member)))

      return { ...union, kind: only.kind, type: only.type, alias: isAlias || only.alias }
    }

    if (type === 'object' || isOf(['object', 'union'])) {
      return { ...union, kind: 'union' }
    }

    return { ...union, kind: isOf(['string', 'number', 'scalars']) ? 'scalars' : 'other' }
  }

  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    const inner = schema.allOf.map(toInner)
    const typed = inner.find(({ kind }) => kind !== 'other')
    const [only] = schema.allOf

    return {
      kind: type === undefined ? (typed?.kind ?? 'other') : toScalarKind(type),
      type: type ?? typed?.type,
      nullable: isOpen && inner.every(member => member.nullable),
      nullableInCore: nullableInCore || inner.some(member => member.nullableInCore),
      alias: schema.allOf.length === 1 && isRef(only)
    }
  }

  return { kind: toScalarKind(type), type, nullable, nullableInCore, alias: false }
}

/** The grid's target nearest to a raw one. */
const toGridTarget = ({ kind, nullable, alias }: RawTarget, cyclic: boolean): Target | undefined => {
  const score = (target: Target) =>
    (target.cyclic === cyclic ? 4 : 0) + (target.nullable === nullable ? 2 : 0) + (target.alias === alias ? 1 : 0)

  return TARGETS.filter(target => target.kind === kind).sort((a, b) => score(b) - score(a))[0]
}

type Site = { spelling: string; refs: Ref[]; keywords: Record<string, unknown>; hasNullMember: boolean }

const withoutKeys = (schema: Record<string, unknown>, ...keys: string[]): Record<string, unknown> =>
  Object.fromEntries(Object.entries(schema).filter(([key]) => !keys.includes(key)))

/** The site that a raw object is, or why the grid has no place for it. */
export const toSite = (schema: Record<string, unknown>): Site | string | undefined => {
  if (isRef(schema)) {
    const keywords = withoutKeys(schema, '$ref')

    return canNameSchema(schema) && Object.keys(keywords).length > 0
      ? { spelling: '$ref', refs: [schema], keywords, hasNullMember: false }
      : undefined
  }

  const groups = ['allOf', 'anyOf', 'oneOf'].filter(key => Array.isArray(schema[key]))
  const [group] = groups
  const members = group === undefined ? undefined : schema[group]

  if (group === undefined || !Array.isArray(members) || !members.some(isRef)) {
    return undefined
  }

  if (groups.length > 1) {
    return 'two of allOf, anyOf and oneOf'
  }

  const refs = members.filter(isRef)
  const beside = withoutKeys(schema, group, 'discriminator')

  if (group === 'allOf') {
    const inline = members.filter(member => !isRef(member)).filter(isRecord)

    if (inline.some(member => ['allOf', 'anyOf', 'oneOf'].some(key => key in member))) {
      return 'an allOf with a member that is an allOf, anyOf or oneOf'
    }

    const keywords = Object.assign({}, ...inline, beside)
    const spelling =
      refs.length > 1 ? 'allOf [ref, ref]' : inline.length > 0 ? 'allOf [ref, {keyword}]' : 'allOf [ref]'

    return { spelling, refs, keywords, hasNullMember: false }
  }

  const others = members.filter(member => !isNullMember(member))
  const hasNullMember = others.length < members.length

  if (hasNullMember && others.length > 1) {
    return 'a union of two or more and null'
  }

  const inside = others.length > 1 ? '[ref, ref]' : hasNullMember ? '[ref, null]' : '[ref]'

  return { spelling: `${group} ${inside}`, refs, keywords: beside, hasNullMember }
}

/** The grid keywords that the keywords at a site are, or why there is none for its `type`. */
export const toGridKeywords = (keywords: Record<string, unknown>, target: RawTarget): string[] => {
  const { type, nullable, enum: enums } = keywords
  const isList = (value: unknown): value is unknown[] => Array.isArray(value)

  const toTypeKeyword = (): string[] => {
    if (type === undefined) {
      return typeof nullable === 'boolean' ? [`nullable: ${nullable}`] : []
    }

    if (isList(type)) {
      return type.length === 2 && type.includes('null') ? ['type: [type, null]'] : ['a list of types']
    }

    const expected = target.type ?? (target.kind === 'other' ? undefined : TYPES[target.kind])

    if (type !== expected) {
      const isNarrower =
        (type === 'integer' && expected === 'number') ||
        (target.kind === 'scalars' && (type === 'string' || type === 'number' || type === 'integer'))

      return [isNarrower ? 'type, narrower' : 'another type']
    }

    if (typeof nullable === 'boolean') {
      return [`type with nullable: ${nullable}`]
    }

    return [target.nullable ? "type, without the target's null" : 'type, the same']
  }

  return [
    'none',
    ...toTypeKeyword(),
    ...(isList(enums) ? [enums.includes(null) ? 'enum with null' : 'enum'] : []),
    ...('const' in keywords ? ['const'] : []),
    ...('default' in keywords ? [keywords.default === null ? 'default: null' : 'default'] : []),
    ...(isList(keywords.required) && keywords.required.length > 0 ? ['required'] : []),
    ...(isRecord(keywords.properties) && Object.keys(keywords.properties).length > 0 ? ['properties'] : []),
    ...(keywords.additionalProperties === false ? ['additionalProperties: false'] : []),
    ...['minLength', 'minimum', 'not', 'externalDocs'].filter(key => key in keywords),
    ...['readOnly', 'deprecated'].filter(key => keywords[key] === true),
    ...(typeof keywords.description === 'string' ? ['description'] : [])
  ]
}

export type SiteCell = {
  cell: Cell
  pointer: string
  /** No other keyword at the site changes values. */
  alone: boolean
  /** The target is not nullable by the rules, and core reads it as nullable. */
  nullableInCore: boolean
}

export type DocumentSites = { sites: SiteCell[]; outside: string[] }

/** The cells of each site in a raw document, and why other sites are in none. */
export const toDocumentSites = (document: unknown): DocumentSites => {
  const version = isRecord(document) ? toVersion(document.openapi) : undefined

  if (version === undefined) {
    return { sites: [], outside: ['a document of another version'] }
  }

  const cyclic = toCyclicRefs(document)

  const results = toObjects(document).map(({ pointer, value }): DocumentSites => {
    const site = toSite(value)

    if (site === undefined) {
      return { sites: [], outside: [] }
    }

    if (typeof site === 'string') {
      return { sites: [], outside: [site] }
    }

    const targets = site.refs.map(ref => ({
      ref,
      ...toRawTarget({ version, document, schema: toRefTarget(document, ref) })
    }))
    const first = targets.find(({ kind }) => kind !== 'other')

    if (first === undefined) {
      const isMissing = site.refs.every(ref => toRefTarget(document, ref) === undefined)

      return { sites: [], outside: [isMissing ? 'a target that is not in the document' : 'a target of another kind'] }
    }

    // In an allOf of two, the grid's target allows null and the other member does not.
    const nullable =
      site.spelling === 'allOf [ref, ref]'
        ? targets.some(target => target.nullable) && !targets.every(target => target.nullable)
        : targets.some(target => target.nullable)
    const isCyclic = targets.some(({ ref }) => cyclic.has(ref))
    const target = toGridTarget({ ...first, nullable }, isCyclic)

    if (target === undefined) {
      return { sites: [], outside: ['a target of another kind'] }
    }

    const keywords = toGridKeywords(site.keywords, { ...first, nullable })
    const ofValues = keywords.filter(keyword => keyword !== 'none' && toAnnotation(keyword) === undefined)

    return {
      sites: keywords.map(keyword => ({
        cell: { version, keyword, spelling: site.spelling, target: target.name },
        pointer,
        alone: ofValues.every(other => other === keyword),
        nullableInCore: !nullable && targets.some(({ nullableInCore }) => nullableInCore)
      })),
      outside: []
    }
  })

  return {
    sites: results.flatMap(({ sites }) => sites),
    outside: results.flatMap(({ outside }) => outside)
  }
}

export type CellCount = {
  cell: Cell
  sites: number
  /** The sites with no other keyword that changes values. */
  alone: number
  documents: string[]
  /** How many of the sites have a target that only core reads as nullable. */
  nullableInCore: number
  /** The first few sites, as `<document> <pointer>`. */
  examples: string[]
}

export type Count = {
  documents: number
  sites: number
  cells: CellCount[]
  /** Why a site is in no cell, with how many there are. */
  outside: Record<string, number>
}

const EXAMPLES = 3

/** The counts of raw documents, given one at a time with their names. */
export const toCount = async (documents: AsyncIterable<{ name: string; document: unknown }>): Promise<Count> => {
  const cells = new Map<string, CellCount>()
  const outside = new Map<string, number>()
  const totals = { documents: 0, sites: 0 }

  for await (const { name, document } of documents) {
    const found = toDocumentSites(document)

    totals.documents += 1
    totals.sites += found.sites.filter(({ cell }) => cell.keyword === 'none').length
    found.outside.forEach(reason => outside.set(reason, (outside.get(reason) ?? 0) + 1))

    for (const { cell, pointer, alone, nullableInCore } of found.sites) {
      const key = JSON.stringify(cell)
      const count = cells.get(key) ?? { cell, sites: 0, alone: 0, documents: [], nullableInCore: 0, examples: [] }

      count.sites += 1
      count.alone += alone ? 1 : 0
      count.nullableInCore += nullableInCore ? 1 : 0

      if (count.documents.at(-1) !== name) {
        count.documents.push(name)
      }

      if (count.examples.length < EXAMPLES) {
        count.examples.push(`${name} ${pointer}`)
      }

      cells.set(key, count)
    }
  }

  return { ...totals, cells: [...cells.values()], outside: Object.fromEntries(outside) }
}

/** The OpenAPI documents in a directory and those inside it, in the order of their names. */
export async function* readDocuments(directory: string): AsyncGenerator<{ name: string; document: unknown }> {
  const entries = await Array.fromAsync(walk(directory, { exts: ['.json'], includeDirs: false }))
  const names = entries.map(({ path }) => relative(directory, path)).sort()

  for (const name of names) {
    const document: unknown = JSON.parse(await Deno.readTextFile(join(directory, name)))

    if (isRecord(document) && typeof document.openapi === 'string') {
      yield { name: name.replaceAll(SEPARATOR, '/'), document }
    }
  }
}

/**
 * The sites where a `type` beside one ref excludes the null of the target. The
 * target accepts null by the rules: one that only core reads as nullable has
 * no null for the `type` to exclude.
 */
export const toNullSites = (count: Count): CellCount[] =>
  count.cells.filter(
    ({ cell }) =>
      ["type, without the target's null", 'type with nullable: false'].includes(cell.keyword) &&
      ['allOf [ref]', 'anyOf [ref]', 'oneOf [ref]'].includes(cell.spelling) &&
      TARGETS.some(({ name, nullable }) => nullable && name === cell.target)
  )

if (import.meta.main) {
  const [directory, output] = Deno.args

  if (directory === undefined || output === undefined) {
    console.error('Usage: openapi-grid-count.ts <documents> <output.json>')
    Deno.exit(1)
  }

  const count = await toCount(readDocuments(directory))
  const nullSites = toNullSites(count)

  Deno.writeTextFileSync(output, JSON.stringify(count))
  console.log(
    JSON.stringify(
      {
        documents: count.documents,
        sites: count.sites,
        outside: count.outside,
        nullSites: {
          sites: nullSites.reduce((sum, { sites }) => sum + sites, 0),
          documents: new Set(nullSites.flatMap(({ documents }) => documents)).size,
          examples: nullSites.flatMap(({ examples }) => examples)
        }
      },
      undefined,
      2
    )
  )
}
