#!/usr/bin/env node
import { readdirSync, existsSync, writeFileSync, mkdirSync, statSync, readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeGenerator } from './analyze.ts'
import { formatAggregate } from './aggregate.ts'
import { CHECKS } from './checks/index.ts'
import type { GeneratorReport } from './types.ts'

// The stock generators live in the sibling skmtc-generators repo:
// <skmtc-root>/skmtc/packages/gen-eval/src → <skmtc-root>/skmtc-generators
const STOCK_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../skmtc-generators')

const DOCS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../docs')

type CliArgs = {
  targets: string[]
  scan: string | undefined
  jsonOut: string | undefined
  mdOut: string | undefined
  verbose: boolean
}

const USAGE =
  'usage: gen-eval [genDir ...] [--scan parentDir | --stock] [--json out.json] [--md out.md]'

const parseArgs = (argv: string[]): CliArgs => {
  const args: CliArgs = { targets: [], scan: undefined, jsonOut: undefined, mdOut: undefined, verbose: false }
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index]
    if (value === '--scan') args.scan = argv[++index]
    else if (value === '--stock') args.scan = STOCK_DIR
    else if (value === '--json') args.jsonOut = argv[++index]
    else if (value === '--md') args.mdOut = argv[++index]
    else if (value === '--verbose') args.verbose = true
    else if (value === '--help' || value === '-h') {
      console.log(USAGE)
      process.exit(0)
    } else if (value !== undefined && value.startsWith('-')) {
      // An unknown flag must not fall through to the target list — it
      // would be resolved as a directory and crash with a stack trace.
      console.error(`unknown flag: ${value}`)
      console.error(USAGE)
      process.exit(2)
    } else if (value !== undefined) args.targets.push(value)
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
  const { classTotals, methodDiscipline, strings, topLevelProjection, producerSizes } = report
  const topProjection = topLevelProjection.pass
    ? 'ok'
    : topLevelProjection.exempt
      ? 'exempt(acc)'
      : 'FAIL'
  const maxBucket = producerSizes.at(-1)?.bucket
  return [
    report.generator,
    formatAggregate(report.aggregate),
    report.structure.pass ? 'ok' : `missing:${report.structure.missing.length}`,
    `${classTotals.projections}P/${classTotals.snippets}S/${classTotals.other}O`,
    pct(report.producerShare),
    `${methodDiscipline.clean}/${methodDiscipline.producers}`,
    `${strings.outsideCount} (${pct(strings.outsideShare)})`,
    topProjection,
    report.accumulator.verdict ? 'yes' : 'no',
    maxBucket === undefined ? '—' : `≤${maxBucket}`,
    report.toStringPurity.pass ? 'ok' : `FAIL:${report.toStringPurity.violations.length}`,
    report.adHocToString.pass ? 'ok' : `FAIL:${report.adHocToString.sites.length}`,
    `${report.asCasts.count}`,
    `${report.redundantRefGuards.count}`,
    `${report.registrationChannels.rawDefinitionRegisters.length}`,
    report.templateImports.pass ? 'ok' : `FAIL:${report.templateImports.sites.length}`,
    `${report.emittedTodos.count}`,
    report.runtimeDiscipline.pass ? 'ok' : `FAIL:${report.runtimeDiscipline.violations.length}`,
    report.singleDispatch.pass ? 'ok' : `FAIL:${report.singleDispatch.outside.length}`
  ]
}

const HEADER = [
  'generator',
  'verdict',
  'structure',
  'classes',
  'producer%',
  'clean-methods',
  'str-outside',
  'top-proj',
  'acc',
  'max-size',
  'pure',
  'adhoc',
  'as',
  'ref-guard',
  'raw-reg',
  'tpl-imp',
  'todo',
  'runtime',
  'dispatch'
]

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

// Every check id whose defect shows in this report — failed pass/fail
// checks plus warning categories with nonzero counts.
const flaggedCheckIds = (report: GeneratorReport): string[] => {
  const ids = [...report.aggregate.failedChecks]
  const { warnings } = report.aggregate
  if (warnings.flaggedProducers > 0) ids.push('method-discipline')
  if (warnings.asCasts > 0) ids.push('as-casts')
  if (warnings.redundantRefGuards > 0) ids.push('redundant-ref-guard')
  if (warnings.rawDefinitionRegisters > 0) ids.push('registration-channels')
  if (warnings.emittedTodos > 0) ids.push('emitted-todos')
  if (warnings.otherClasses > 0) ids.push('producer-share')
  if (warnings.outsideShareHigh) ids.push('string-composition')
  return [...new Set(ids)]
}

// Inline a check's doc file (headings demoted two levels) so the report
// itself states what the check operationally asserts and why — reading
// the check's source should never be necessary.
const inlineCheckDoc = (id: string): string[] => {
  const check = CHECKS.find(entry => entry.id === id)
  if (!check) return []
  const docPath = join(DOCS_DIR, check.doc)
  if (!existsSync(docPath)) return []
  return [readFileSync(docPath, 'utf8').trim().replace(/^(#+)/gm, '##$1'), '']
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
    lines.push(
      `- verdict: **${formatAggregate(report.aggregate)}**${report.aggregate.failedChecks.length ? ` — failed: ${report.aggregate.failedChecks.join(', ')}` : ''}`
    )
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
    if (report.methodDiscipline.accumulatorExempt.length > 0) {
      lines.push(`- accumulator-exempt extra methods:`)
      for (const exemptClass of report.methodDiscipline.accumulatorExempt) {
        lines.push(`  - ${exemptClass.className} (${exemptClass.kind}): ${exemptClass.extraMethods.join(', ')}`)
      }
    }
    if (report.producerSizes.length > 0) {
      lines.push(
        `- producer sizes (lines, nearest 50): ${report.producerSizes.map(size => `≤${size.bucket}: ${size.count}`).join(', ')}`
      )
      const big = report.classes
        .filter(item => item.kind !== 'other' && item.sizeBucket >= 150)
        .sort((a, b) => b.lines - a.lines)
      for (const bigClass of big.slice(0, 6)) {
        lines.push(`  - ${bigClass.className} (${bigClass.kind}) — ${bigClass.lines} lines (~${bigClass.sizeBucket})`)
      }
    }
    if (report.accumulator.signals.length > 0) {
      lines.push(
        `- accumulator: ${report.accumulator.verdict ? 'YES' : 'no'} — signals: ${report.accumulator.signals.join('; ')}`
      )
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
      `- top-level projection: ${report.topLevelProjection.pass ? 'ok' : report.topLevelProjection.exempt ? 'exempt (accumulator)' : 'FAIL'}`
    )
    lines.push(
      `- single dispatch (axiom 1): ${report.singleDispatch.pass ? 'ok' : 'FAIL'} — ${report.singleDispatch.routerCount} router site(s), ${report.singleDispatch.metadataCount} metadata site(s), ${report.singleDispatch.outside.length} outside`
    )
    if (report.singleDispatch.outside.length > 0) {
      lines.push(`- schema-type dispatch OUTSIDE the router:`)
      for (const site of report.singleDispatch.outside) {
        lines.push(`  - \`${site.file}:${site.line}\` in ${site.site} — ${site.text}`)
      }
    }
    if (!report.toStringPurity.pass) {
      lines.push(`- toString purity VIOLATIONS:`)
      for (const violation of report.toStringPurity.violations) {
        lines.push(`  - ${violation.className ?? '<module>'} \`${violation.file}:${violation.line}\` [${violation.kind}] ${violation.detail}`)
      }
    }
    if (!report.adHocToString.pass) {
      lines.push(`- ad-hoc { toString } object literals:`)
      for (const site of report.adHocToString.sites) {
        lines.push(`  - \`${site.file}:${site.line}\` in ${site.site}`)
      }
    }
    if (report.asCasts.count > 0) {
      lines.push(`- as-casts (${report.asCasts.count} — each requires approval):`)
      for (const site of report.asCasts.sites) {
        lines.push(`  - \`${site.file}:${site.line}\` in ${site.site} — \`${site.text ?? ''}\``)
      }
    }
    if (report.redundantRefGuards.count > 0) {
      lines.push(
        `- redundant isRef() guards (${report.redundantRefGuards.count} — \`.resolve()\` is identity on concrete schemas; call it unconditionally):`
      )
      for (const site of report.redundantRefGuards.sites) {
        lines.push(`  - \`${site.file}:${site.line}\` in ${site.site} — \`${site.text ?? ''}\``)
      }
    }
    const channels = report.registrationChannels
    lines.push(
      `- registration channels: insertOperation ${channels.insertOperation}, insertModel ${channels.insertModel}, insertNormalizedModel ${channels.insertNormalizedModel}, defineAndRegister ${channels.defineAndRegister}, raw definition registers ${channels.rawDefinitionRegisters.length}`
    )
    for (const site of channels.rawDefinitionRegisters) {
      lines.push(`  - raw: \`${site.file}:${site.line}\` in ${site.site}`)
    }
    if (!report.templateImports.pass) {
      lines.push(`- import statements inside template literals:`)
      for (const site of report.templateImports.sites) {
        lines.push(`  - \`${site.file}:${site.line}\` in ${site.site}`)
      }
    }
    if (report.emittedTodos.count > 0) {
      lines.push(`- TODO markers in emitted text (${report.emittedTodos.count}):`)
      for (const site of report.emittedTodos.sites) {
        lines.push(`  - \`${site.file}:${site.line}\` in ${site.site} — ${site.text ?? ''}`)
      }
    }
    if (!report.runtimeDiscipline.pass) {
      lines.push(`- runtime-discipline VIOLATIONS:`)
      for (const violation of report.runtimeDiscipline.violations) {
        lines.push(`  - \`${violation.file}:${violation.line}\` in ${violation.site} [${violation.category}] ${violation.detail}`)
      }
    }
    const flagged = flaggedCheckIds(report)
    if (flagged.length > 0) {
      lines.push('')
      lines.push(`### What each flagged check means`)
      lines.push('')
      lines.push(
        'The full rule behind every check flagged above, inlined from the',
        "eval's own docs — everything the check source would tell you is",
        'already here.'
      )
      lines.push('')
      for (const id of flagged) {
        lines.push(...inlineCheckDoc(id))
      }
    }
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
    console.error(USAGE)
    process.exit(2)
  }
  const missing = dirs.filter(dir => !existsSync(dir))
  if (missing.length > 0) {
    console.error(`no such generator dir: ${missing.join(', ')}`)
    console.error(USAGE)
    process.exit(2)
  }

  const reports = dirs.map(analyzeGenerator)
  printTable(reports.map(toRow))

  // Any flagged check prints its full rule on STDOUT — the output the
  // caller actually reads first (run 195833 dove into check source
  // because the rule text lived only in the --md report it didn't
  // know to generate). Sites still live in --md.
  for (const report of reports) {
    const flagged = flaggedCheckIds(report)
    if (flagged.length === 0) continue
    console.log(
      `\n${report.generator} — the rule behind each flagged check (flagged SITES: rerun with --md <file>):`
    )
    for (const id of flagged) {
      console.log(`\n${inlineCheckDoc(id).join('\n').trimEnd()}`)
    }
  }

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
