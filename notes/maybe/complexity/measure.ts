/**
 * Measure cyclomatic complexity across a generators checkout.
 *
 *   deno run -A notes/maybe/complexity/measure.ts <path-to-skmtc-generators> [--exclude <file>]...
 *
 * `--exclude Maybe.ts` leaves out a local copy of framework classes, so the
 * numbers cover generator code only.
 *
 * Runs `plugin.ts` over the non-test files under each generator's `src`
 * folder (`gen-<name>/src`), then prints
 * the producer distribution, the most complex producers and module
 * functions, and the producer branches grouped by what they test.
 */
import type { Entry } from './plugin.ts'

type Diagnostic = {
  filename: string
  code: string
  message: string
  range: { start: { line: number } }
}

type Row = Entry & { path: string; gen: string; score: number; worst: string }

const [root, ...flags] = Deno.args
const excluded = new Set(
  flags.flatMap((flag, index) => (flag === '--exclude' ? [flags[index + 1]] : []))
)
if (root === undefined) throw new Error('usage: measure.ts <path-to-skmtc-generators>')

const here = new URL('.', import.meta.url).pathname

const toFiles = async (dir: string): Promise<string[]> => {
  const files: string[] = []
  for await (const entry of Deno.readDir(dir)) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory && entry.name !== 'test' && entry.name !== 'node_modules') {
      files.push(...(await toFiles(path)))
    } else if (
      entry.isFile &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !excluded.has(entry.name)
    ) {
      files.push(path)
    }
  }
  return files
}

const generators: string[] = []
for await (const entry of Deno.readDir(root)) {
  if (entry.isDirectory && entry.name.startsWith('gen-')) generators.push(entry.name)
}

const files = (
  await Promise.all(generators.map(gen => toFiles(`${root}/${gen}/src`).catch((): string[] => [])))
).flat()

const { stdout } = await new Deno.Command('deno', {
  args: ['lint', '--config', `${here}deno.json`, '--json', ...files],
  stdout: 'piped',
  stderr: 'null'
}).output()

const diagnostics: Diagnostic[] = JSON.parse(new TextDecoder().decode(stdout)).diagnostics

const rows: Row[] = diagnostics
  .filter(diagnostic => diagnostic.code === 'cc/producer-complexity')
  .map(diagnostic => {
    const entry: Entry = JSON.parse(diagnostic.message)
    const path = `${diagnostic.filename.replace(/^file:\/\/.*?\/(gen-)/, '$1')}:${diagnostic.range.start.line}`
    const worst = entry.members.reduce(
      (best, member) => (member.decisions > best.decisions ? member : best),
      { name: '-', decisions: -1, tests: [] }
    )
    return {
      ...entry,
      path,
      gen: path.split('/')[0],
      // One entry path for the class plus every decision in its members.
      score: 1 + entry.members.reduce((sum, member) => sum + member.decisions, 0),
      worst: `${worst.name} ${worst.decisions + 1}`
    }
  })

const producers = rows.filter(row => row.kind === 'producer').sort((a, b) => b.score - a.score)
const functions = rows.filter(row => row.kind === 'function').sort((a, b) => b.score - a.score)

const scores = producers.map(row => row.score).sort((a, b) => a - b)
const quantile = (q: number) => scores[Math.floor(q * (scores.length - 1))]
const buckets = { '1': 0, '2-5': 0, '6-10': 0, '11-20': 0, '>20': 0 }
for (const score of scores) {
  const bucket =
    score === 1 ? '1' : score <= 5 ? '2-5' : score <= 10 ? '6-10' : score <= 20 ? '11-20' : '>20'
  buckets[bucket]++
}

console.log(`producers ${producers.length}, module functions ${functions.length}`)
console.log(
  `producer score: median ${quantile(0.5)}, p75 ${quantile(0.75)}, p90 ${quantile(0.9)}, max ${quantile(1)}`
)
console.log(buckets)

console.log('\nproducers scoring 6 or more')
for (const row of producers.filter(row => row.score >= 6)) {
  console.log(
    `${String(row.score).padStart(3)}  ${row.name.padEnd(26)} ${row.worst.padEnd(16)} ${row.path}`
  )
}

console.log('\nmodule functions scoring 11 or more')
for (const row of functions.filter(row => row.score >= 11)) {
  console.log(`${String(row.score).padStart(3)}  ${row.name.padEnd(26)} ${row.path}`)
}

// What producer branches test. First match wins, so order matters.
const categories: [string, RegExp][] = [
  ['schema-type dispatch', /\.type\b|instanceof Oas|isRef\(\)|^SwitchCase/],
  [
    'fallback for a missing value (??, === undefined)',
    /^Logical \?\?|[!=]== undefined|[!=]== null/
  ],
  ['empty or length check', /\.length|isEmpty|Object\.(keys|entries|values)/],
  [
    'text-or-nothing on a flag (x ? … : …, x && …)',
    /^(ConditionalExpression|Logical &&|Logical \|\||IfStatement)/
  ]
]

const tests = producers.flatMap(row => row.members.flatMap(member => member.tests))
const counted = new Map<string, number>()
for (const test of tests) {
  const category = categories.find(([, pattern]) => pattern.test(test))?.[0] ?? 'other'
  counted.set(category, (counted.get(category) ?? 0) + 1)
}

console.log(`\nproducer decisions: ${tests.length}`)
for (const [category, count] of [...counted].sort((a, b) => b[1] - a[1])) {
  console.log(
    `${String(count).padStart(4)}  ${String(Math.round((100 * count) / tests.length)).padStart(3)}%  ${category}`
  )
}

// Per generator: the sum of every producer and module-function score.
const perGenerator = new Map<string, { total: number; branches: number; units: number }>()
for (const row of rows) {
  const entry = perGenerator.get(row.gen) ?? { total: 0, branches: 0, units: 0 }
  entry.total += row.score
  entry.branches += row.score - 1
  entry.units++
  perGenerator.set(row.gen, entry)
}

console.log('\nper generator: total, branches, classes + module functions')
for (const [gen, entry] of [...perGenerator].sort((a, b) => b[1].total - a[1].total)) {
  console.log(
    `${gen.padEnd(34)} ${String(entry.total).padStart(4)} ${String(entry.branches).padStart(4)} ${String(entry.units).padStart(4)}`
  )
}
