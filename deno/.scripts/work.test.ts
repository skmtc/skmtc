import { assertEquals, assertRejects, assertStringIncludes, assertThrows } from '@std/assert'
import { fromFileUrl, join } from '@std/path'
import {
  checkWork,
  collectCalls,
  computeWork,
  isWorkRecord,
  roundCount,
  toRecordedFunctions,
  type Work
} from './work.ts'
import { generateWork } from './work-run.ts'

const denoDir = fromFileUrl(new URL('..', import.meta.url))
const runPath = join(denoDir, '.scripts', 'work-run.ts')

const toScript = (url: string, functions: [name: string, ...counts: number[]][]) => ({
  scriptId: '1',
  url,
  functions: functions.map(([functionName, ...counts]) => ({
    functionName,
    ranges: counts.map(count => ({ startOffset: 0, endOffset: 1, count })),
    isBlockCoverage: true
  }))
})

const toWork = (functions: Record<string, number>, calls = functions): Work => ({
  record: { deno: '2.9.8', functions },
  calls: new Map(Object.entries(calls))
})

/** A run that calls one function of `core` `calls` times, for one generated file. */
const computeFixtureWork = async (calls: number): Promise<Work> => {
  const fixtureDir = await Deno.makeTempDir({ prefix: 'skmtc-work-fixture-' })

  try {
    await Deno.mkdir(join(fixtureDir, 'core'))
    await Deno.writeTextFile(
      join(fixtureDir, 'core', 'visit.ts'),
      'export function visit() {}\nexport function visitOnce() {}\n'
    )
    await Deno.writeTextFile(
      join(fixtureDir, 'run.ts'),
      `import { visit, visitOnce } from './core/visit.ts'
visitOnce()
Array.from({ length: ${calls} }).forEach(() => visit())
console.log(JSON.stringify({ files: 1 }))
`
    )

    return await computeWork({ denoDir: fixtureDir, runPath: join(fixtureDir, 'run.ts') })
  } finally {
    await Deno.remove(fixtureDir, { recursive: true })
  }
}

Deno.test('the check fails when a function is called twice where it was called once', async () => {
  const once = await computeFixtureWork(10)
  const twice = await computeFixtureWork(20)

  assertEquals(once.record.functions, { 'core/visit.ts visit': 10 })
  assertEquals(checkWork(once.record, once), [])
  assertEquals(checkWork(once.record, twice), [
    'The number of calls moved for 1 function(s):',
    '  core/visit.ts visit: 10 -> 20',
    'If the change is meant, run `deno task record-work` and commit .scripts/work.json.'
  ])
})

Deno.test('a run with no function to record fails', async () => {
  await assertRejects(() => computeFixtureWork(5), Error, 'was called often enough')
})

Deno.test('two runs of the document give the same record', async () => {
  const first = await computeWork({ denoDir, runPath })
  const second = await computeWork({ denoDir, runPath })

  assertEquals(first.record, second.record)
})

Deno.test('the run generates models and operations', async () => {
  const { artifacts } = await generateWork()
  const paths = Object.keys(artifacts)
  const countIn = (directory: string) => paths.filter(path => path.startsWith(directory)).length

  assertEquals(countIn('models/') > 100, true)
  assertEquals(countIn('operations/') > 100, true)
  assertEquals(countIn('models/') + countIn('operations/'), paths.length)
})

Deno.test('collectCalls counts the named functions of core and lang-typescript', () => {
  const scripts = [
    toScript('file:///deno/core/a.ts', [
      ['', 1],
      // A later range is a block inside the function.
      ['parse', 7, 90],
      ['toString', 2],
      ['toString', 3]
    ]),
    toScript('file:///deno/lang-typescript/src/List.ts', [['List', 4]]),
    toScript('file:///deno/.scripts/work-run.ts', [['run', 5]]),
    toScript('file:///deno/cli/mod.ts', [['cli', 5]]),
    toScript('file:///elsewhere/core/a.ts', [['other', 5]])
  ]

  assertEquals(Object.fromEntries(collectCalls(scripts, 'file:///deno/')), {
    'core/a.ts parse': 7,
    'core/a.ts toString': 5,
    'lang-typescript/src/List.ts List': 4
  })
})

Deno.test('collectCalls refuses a coverage format it does not know', () => {
  assertThrows(() => collectCalls([{ url: 'file:///deno/core/a.ts' }], 'file:///deno/'))
  assertThrows(() =>
    collectCalls(
      [{ url: 'file:///deno/core/a.ts', functions: [{ functionName: 'a', ranges: [] }] }],
      'file:///deno/'
    )
  )
})

Deno.test('the record has the functions called more than 5 times a file, rounded and by name', () => {
  const calls = new Map([
    ['core/b.ts often', 1249],
    ['core/a.ts often', 1251],
    ['core/a.ts limit', 500]
  ])
  const functions = toRecordedFunctions(calls, 100)

  assertEquals(Object.entries(functions), [
    ['core/a.ts often', 1300],
    ['core/b.ts often', 1200]
  ])
})

Deno.test('roundCount keeps two significant digits', () => {
  assertEquals([0, 7, 10, 104, 426462].map(roundCount), [0, 7, 10, 100, 430000])
})

Deno.test('checkWork names a count that fell, and one that was not in the record', () => {
  const recorded = { deno: '2.9.8', functions: { 'core/a.ts fell': 900, 'core/a.ts kept': 800 } }
  const current = toWork(
    { 'core/a.ts kept': 800, 'core/a.ts rose': 700 },
    { 'core/a.ts fell': 123, 'core/a.ts kept': 801, 'core/a.ts rose': 701 }
  )

  assertEquals(checkWork(recorded, current).slice(0, -1), [
    'The number of calls moved for 2 function(s):',
    '  core/a.ts fell: 900 -> 120',
    '  core/a.ts rose: not in the record -> 700'
  ])
})

Deno.test('checkWork reports another deno only when a count moved', () => {
  const recorded = { deno: '2.8.0', functions: { 'core/a.ts parse': 900 } }

  assertEquals(checkWork(recorded, toWork({ 'core/a.ts parse': 900 })), [])

  const report = checkWork(recorded, toWork({ 'core/a.ts parse': 700 })).join('\n')

  assertStringIncludes(report, 'core/a.ts parse: 900 -> 700')
  assertStringIncludes(report, 'made with deno 2.8.0 and this is deno 2.9.8')
  assertStringIncludes(report, 'deno task record-work')
})

Deno.test('checkWork fails on a record that is missing, malformed or empty', () => {
  const current = toWork({ 'core/a.ts parse': 900 })

  for (const recorded of [undefined, { deno: '2.9.8' }, { deno: '2.9.8', functions: {} }]) {
    const report = checkWork(recorded, current)

    assertEquals(report.length, 1)
    assertStringIncludes(report[0], 'missing, malformed or empty')
  }
})

Deno.test('isWorkRecord accepts the committed record and refuses a damaged one', async () => {
  const committed = JSON.parse(await Deno.readTextFile(join(denoDir, '.scripts', 'work.json')))

  assertEquals(isWorkRecord(committed), true)
  assertEquals(isWorkRecord({ ...committed, functions: { a: '1' } }), false)
  assertEquals(isWorkRecord({ functions: {} }), false)
})
