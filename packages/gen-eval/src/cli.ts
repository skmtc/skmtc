#!/usr/bin/env node
import { readdirSync, existsSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { analyzeGenerator } from './analyze.ts'
import type { GeneratorReport } from './types.ts'

type CliArgs = {
  targets: string[]
  scan: string | undefined
  jsonOut: string | undefined
  mdOut: string | undefined
  verbose: boolean
}

const parseArgs = (argv: string[]): CliArgs => {
  const args: CliArgs = { targets: [], scan: undefined, jsonOut: undefined, mdOut: undefined, verbose: false }
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index]
    if (value === '--scan') args.scan = argv[++index]
    else if (value === '--json') args.jsonOut = argv[++index]
    else if (value === '--md') args.mdOut = argv[++index]
    else if (value === '--verbose') args.verbose = true
    else if (value !== undefined) args.targets.push(value)
  }
  return args
}

const findGeneratorDirs = (parent: string): string[] =>
  readdirSync(parent)
    .filter(entry => entry.startsWith('gen-'))
    .map(entry => join(parent, entry))
    .filter(dir => statSync(dir).isDirectory() && existsSync(join(dir, 'deno.json')))

const pct = (value: number): string => `${Math.round(value * 100)}%`

const mark = (pass: boolean): string => (pass ? 'ok' : 'FAIL')

const toRow = (report: GeneratorReport): string[] => {
  const { classTotals, methodDiscipline, strings, topLevelProjection } = report
  const topProjection = topLevelProjection.pass
    ? 'ok'
    : topLevelProjection.exempt
      ? 'exempt(acc)'
      : 'FAIL'
  return [
    report.generator,
    report.structure.pass ? 'ok' : `missing:${report.structure.missing.length}`,
    `${classTotals.projections}P/${classTotals.snippets}S/${classTotals.other}O`,
    pct(report.producerShare),
    `${methodDiscipline.clean}/${methodDiscipline.producers}`,
    `${strings.outsideCount} (${pct(strings.outsideShare)})`,
    topProjection
  ]
}

const HEADER = ['generator', 'structure', 'classes', 'producer%', 'clean-methods', 'str-outside', 'top-proj']

const printTable = (rows: string[][]): void => {
  const widths = HEADER.map((header, column) =>
    Math.max(header.length, ...rows.map(row => (row[column] ?? '').length))
  )
  const formatRow = (row: string[]): string =>
    row.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join('  ')
  console.log(formatRow(HEADER))
  console.log(widths.map(width => '-'.repeat(width)).join('  '))
  for (const row of rows) console.log(formatRow(row))
}

const toMarkdown = (reports: GeneratorReport[]): string => {
  const lines: string[] = [
    '# Generator structural eval',
    '',
    `Analyzed ${reports.length} generator(s). Checks derive from the skmtc-generator`,
    'skill: expected file structure, producer-class share, method discipline',
    '(constructor + toString only), string composition inside toString, and a',
    'top-level Projection (accumulator generators exempt).',
    '',
    `| ${HEADER.join(' | ')} |`,
    `|${HEADER.map(() => '---').join('|')}|`
  ]
  for (const report of reports) {
    lines.push(`| ${toRow(report).join(' | ')} |`)
  }
  lines.push('')

  for (const report of reports) {
    lines.push(`## ${report.generator}`, '')
    lines.push(`- dir: \`${report.dir}\``)
    lines.push(`- structure: ${mark(report.structure.pass)}${report.structure.missing.length ? ` — missing: ${report.structure.missing.join(', ')}` : ''}`)
    lines.push(
      `- classes: ${report.classTotals.projections} projection(s) [${report.classes.filter(c => c.kind === 'projection').map(c => c.className).join(', ') || '—'}], ` +
        `${report.classTotals.snippets} snippet(s), ${report.classTotals.other} other [${report.classes.filter(c => c.kind === 'other').map(c => c.className).join(', ') || '—'}]`
    )
    if (report.helperFunctions.length > 0) {
      lines.push(`- helper functions (${report.helperFunctions.length}): ${report.helperFunctions.slice(0, 12).join(', ')}${report.helperFunctions.length > 12 ? ', …' : ''}`)
    }
    if (report.methodDiscipline.flagged.length > 0) {
      lines.push(`- producers with extra methods:`)
      for (const flaggedClass of report.methodDiscipline.flagged) {
        lines.push(`  - ${flaggedClass.className} (${flaggedClass.kind}): ${flaggedClass.extraMethods.join(', ')}`)
      }
    }
    const { strings } = report
    lines.push(
      `- strings: inside toString ${strings.insideToStringCount} node(s)/${strings.insideToStringChars} chars; ` +
        `naming statics ${strings.namingStaticsCount}; outside ${strings.outsideCount} node(s)/${strings.outsideChars} chars (${pct(strings.outsideShare)} of composition)`
    )
    if (strings.topOutsideSites.length > 0) {
      lines.push(`- top outside-toString sites:`)
      for (const site of strings.topOutsideSites) {
        lines.push(`  - \`${site.file}\` ${site.site} — ${site.count} node(s), ${site.chars} chars`)
      }
    }
    lines.push(
      `- top-level projection: ${report.topLevelProjection.pass ? 'ok' : report.topLevelProjection.exempt ? 'exempt (accumulator pattern)' : 'FAIL'}`
    )
    lines.push(`- accumulator pattern (defineAndRegister): ${report.accumulatorPattern ? 'yes' : 'no'}`)
    lines.push('')
  }
  return lines.join('\n')
}

const main = (): void => {
  const args = parseArgs(process.argv.slice(2))
  const dirs = [
    ...args.targets.map(target => resolve(target)),
    ...(args.scan ? findGeneratorDirs(resolve(args.scan)) : [])
  ]
  if (dirs.length === 0) {
    console.error('usage: gen-eval [genDir ...] [--scan parentDir] [--json out.json] [--md out.md]')
    process.exit(2)
  }

  const reports = dirs.map(analyzeGenerator)
  printTable(reports.map(toRow))

  if (args.verbose) {
    for (const report of reports) {
      console.log(`\n=== ${report.generator}`)
      console.log(JSON.stringify(report, null, 2))
    }
  }

  if (args.jsonOut) {
    mkdirSync(dirname(resolve(args.jsonOut)), { recursive: true })
    writeFileSync(resolve(args.jsonOut), JSON.stringify(reports, null, 2))
    console.log(`\nwrote ${args.jsonOut}`)
  }
  if (args.mdOut) {
    mkdirSync(dirname(resolve(args.mdOut)), { recursive: true })
    writeFileSync(resolve(args.mdOut), toMarkdown(reports))
    console.log(`wrote ${args.mdOut}`)
  }
}

main()
