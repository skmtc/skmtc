#!/usr/bin/env -S deno run --allow-read --allow-env
/**
 * The groups of cells in which core and the rules differ, with how many
 * documents have them, as a Markdown table; then how often the spelling alone
 * makes a difference, and the keywords that 3.0 ignores beside a `$ref`.
 *
 * Run from `deno/`: `deno run -A .scripts/openapi-grid-report.ts <grid.json> <count.json>`,
 * with the output of `openapi-grid.ts` and of `openapi-grid-count.ts`.
 *
 * A group is one keyword and one {@link Difference}. A difference that the
 * spelling makes without the keyword is in the group of no keyword only.
 */

import { isRecord } from './api-surface.ts'
import {
  type CellResult,
  type Difference,
  NO_KEYWORD,
  toDifferences,
  toSummary
} from './openapi-grid.ts'
import type { CellCount, Count } from './openapi-grid-count.ts'

export type Group = {
  keyword: string
  difference: Difference
  cells: CellResult[]
  documents: string[]
  sites: number
  /** The sites with no other keyword that changes values. */
  alone: number
  /** The documents and sites of each version and spelling. */
  spellings: { version: string; spelling: string; documents: number; sites: number }[]
}

const toKey = (value: unknown): string => JSON.stringify(value)

const toPlace = ({ cell: { version, spelling, target } }: CellResult): string =>
  toKey([version, spelling, target])

const sum = (counts: CellCount[], of: (count: CellCount) => number): number =>
  counts.reduce((total, count) => total + of(count), 0)

const toDocuments = (counts: CellCount[]): string[] => [
  ...new Set(counts.flatMap(({ documents }) => documents))
]

/** The groups, those in the most documents first. */
export const toGroups = (results: CellResult[], count: Count): Group[] => {
  const counts = new Map(count.cells.map(item => [toKey(item.cell), item]))
  const ofSpelling = new Map(
    results
      .filter(({ cell }) => cell.keyword === NO_KEYWORD)
      .map(result => [toPlace(result), toDifferences(result)])
  )

  const differing = results.flatMap(result => {
    const own = result.cell.keyword === NO_KEYWORD ? [] : (ofSpelling.get(toPlace(result)) ?? [])

    return toDifferences(result)
      .filter(difference => !own.includes(difference))
      .map(difference => ({ result, difference }))
  })

  const groups = Map.groupBy(differing, ({ result, difference }) =>
    toKey([result.cell.keyword, difference])
  )

  return [...groups.values()]
    .flatMap((items): Group[] => {
      const [first] = items

      if (first === undefined) {
        return []
      }

      const cells = items.map(({ result }) => result)
      const found = cells.flatMap(({ cell }) => counts.get(toKey(cell)) ?? [])
      const bySpelling = Map.groupBy(found, ({ cell }) =>
        toKey([cell.version.slice(0, 3), cell.spelling])
      )

      const spellings = [...bySpelling.values()].flatMap(items => {
        const [{ cell } = { cell: undefined }] = items

        return cell === undefined
          ? []
          : [
              {
                version: cell.version.slice(0, 3),
                spelling: cell.spelling,
                documents: toDocuments(items).length,
                sites: sum(items, ({ sites }) => sites)
              }
            ]
      })

      return [
        {
          keyword: first.result.cell.keyword,
          difference: first.difference,
          cells,
          documents: toDocuments(found),
          sites: sum(found, ({ sites }) => sites),
          alone: sum(found, ({ alone }) => alone),
          spellings: spellings.sort((a, b) => b.documents - a.documents)
        }
      ]
    })
    .sort((a, b) => b.documents.length - a.documents.length || b.cells.length - a.cells.length)
}

const toNames = (group: Group, key: 'spelling' | 'version' | 'target'): string[] => [
  ...new Set(group.cells.map(({ cell }) => cell[key]))
]

/** What each side says, in words. */
export const DIFFERENCES: Record<Difference, { rules: string; core: string }> = {
  'null accepted': { rules: 'null is not valid', core: 'null is valid' },
  'null refused': { rules: 'null is valid', core: 'null is not valid' },
  'values accepted': { rules: 'the keyword refuses some values', core: 'those values are valid' },
  'values refused': { rules: 'values of the target are valid', core: 'they are not valid' },
  removed: { rules: 'a schema', core: 'removed, with an error' },
  'no return': { rules: 'a schema', core: 'the parse does not return' },
  'annotation lost': { rules: 'the keyword is at the site', core: 'it is lost' },
  'default that is not valid lost': {
    rules: 'the default is at the site, and not valid',
    core: 'it is lost'
  },
  'annotation kept': { rules: 'the keyword is not read', core: 'it is at the site' }
}

/** The groups as a Markdown table. */
export const toTable = (groups: Group[]): string => {
  const rows = groups.map(group => {
    const { rules, core } = DIFFERENCES[group.difference]
    const spellings = group.spellings.map(
      ({ version, spelling, documents, sites }) =>
        `${version} \`${spelling}\` ${documents} (${sites})`
    )

    const cells = [
      `\`${group.keyword}\``,
      rules,
      core,
      `${group.documents.length} (${group.sites}, alone ${group.alone})`,
      spellings.join('; ') || 'none',
      `${group.cells.length}: ${toNames(group, 'version').join(', ')}; ${toNames(group, 'spelling').length} spellings; ${toNames(group, 'target').length} targets`
    ]

    return `| ${cells.join(' | ')} |`
  })

  return [
    '| Keyword | The rules | Core | Documents (sites) | Where they are | Cells |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows
  ].join('\n')
}

/** How many schemas of a keyword core gives more than one answer, by the spelling. */
export const toSpellingTable = (results: CellResult[]): string => {
  const rows = [...Map.groupBy(results, ({ cell }) => cell.keyword)].map(([keyword, items]) => {
    const { sameSchemas, differInValues, differInAnnotationOnly, differInFormOnly } =
      toSummary(items).spellings

    return `| \`${keyword}\` | ${sameSchemas} | ${differInValues} | ${differInAnnotationOnly} | ${differInFormOnly} |`
  })

  return [
    '| Keyword | Schemas in more than one spelling | Other values | Only another annotation | Only another form |',
    '| --- | --- | --- | --- | --- |',
    ...rows
  ].join('\n')
}

/** The documents with a keyword beside a `$ref` in 3.0, where the rules ignore it and core does too. */
export const toIgnoredTable = (count: Count): string => {
  const ignored = count.cells.filter(
    ({ cell }) =>
      cell.version === '3.0.3' && cell.spelling === '$ref' && cell.keyword !== NO_KEYWORD
  )

  const rows = [...Map.groupBy(ignored, ({ cell }) => cell.keyword)]
    .map(([keyword, items]) => ({
      keyword,
      documents: toDocuments(items).length,
      sites: sum(items, ({ sites }) => sites)
    }))
    .sort((a, b) => b.documents - a.documents)
    .map(({ keyword, documents, sites }) => `| \`${keyword}\` | ${documents} (${sites}) |`)

  return ['| Keyword | Documents (sites) |', '| --- | --- |', ...rows].join('\n')
}

const isResults = (value: unknown): value is CellResult[] =>
  Array.isArray(value) &&
  value.every(item => isRecord(item) && isRecord(item.cell) && isRecord(item.rules))

const isCount = (value: unknown): value is Count => isRecord(value) && Array.isArray(value.cells)

if (import.meta.main) {
  const [gridPath, countPath] = Deno.args

  if (gridPath === undefined || countPath === undefined) {
    console.error('Usage: openapi-grid-report.ts <grid.json> <count.json>')
    Deno.exit(1)
  }

  const results: unknown = JSON.parse(Deno.readTextFileSync(gridPath))
  const count: unknown = JSON.parse(Deno.readTextFileSync(countPath))

  if (!isResults(results) || !isCount(count)) {
    throw new Error('not the output of openapi-grid.ts and openapi-grid-count.ts')
  }

  console.log(
    [toTable(toGroups(results, count)), toSpellingTable(results), toIgnoredTable(count)].join(
      '\n\n'
    )
  )
}
