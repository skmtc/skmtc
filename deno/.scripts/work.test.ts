import { assertEquals, assertRejects, assertStringIncludes, assertThrows } from '@std/assert'
import { dirname, fromFileUrl, join } from '@std/path'
import { isRecord } from './api-surface.ts'
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

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error(`not a record: ${JSON.stringify(value)}`)

  return value
}

const toLeaves = (value: unknown): unknown[] =>
  Array.isArray(value) || isRecord(value) ? Object.values(value).flatMap(toLeaves) : [value]

type WriteFixtureArgs = { directory: string; runPath: string; calls: number }

/** A run that calls one function of `core` `calls` times, for one generated file. */
const writeFixture = async ({ directory, runPath, calls }: WriteFixtureArgs): Promise<void> => {
  await Deno.mkdir(join(directory, 'core'), { recursive: true })
  await Deno.mkdir(dirname(runPath), { recursive: true })
  await Deno.writeTextFile(
    join(directory, 'core', 'visit.ts'),
    'export function visit() {}\nexport function visitOnce() {}\n'
  )
  await Deno.writeTextFile(
    runPath,
    `import { visit, visitOnce } from '../core/visit.ts'
visitOnce()
Array.from({ length: ${calls} }).forEach(() => visit())
console.log(JSON.stringify({ files: 1 }))
`
  )
}

const computeFixtureWork = async (calls: number): Promise<Work> => {
  const fixtureDir = await Deno.makeTempDir({ prefix: 'skmtc-work-fixture-' })
  const runPath = join(fixtureDir, '.scripts', 'work-run.ts')

  try {
    await writeFixture({ directory: fixtureDir, runPath, calls })

    return await computeWork({ denoDir: fixtureDir, runPath })
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
  const { manifest } = await generateWork()
  const work = toRecord(toRecord(manifest.results).work)
  const generated = toRecord(work.generate)

  assertEquals(Object.keys(generated).sort(), ['@work/models', '@work/operations'])

  for (const results of Object.values(generated)) {
    assertEquals(Object.keys(toRecord(results)).length > 100, true)
  }

  assertEquals(new Set(toLeaves(manifest.results)), new Set(['success']))
})

Deno.test('the run emits attribution, as a server does', async () => {
  const { artifacts, sidecars } = await generateWork()

  assertEquals(Object.keys(sidecars ?? {}).length, Object.keys(artifacts).length)
})

type RunTaskArgs = { name: 'check-work' | 'record-work'; cwd: string }

const runTask = async ({ name, cwd }: RunTaskArgs) => {
  const { code, stderr } = await new Deno.Command('deno', { args: ['task', name], cwd }).output()

  return { code, stderr: new TextDecoder().decode(stderr) }
}

Deno.test('the check-work task fails when a count moved or the record is missing', async () => {
  const cwd = await Deno.makeTempDir({ prefix: 'skmtc-work-task-' })
  const scriptsDir = join(cwd, '.scripts')
  const workPath = join(scriptsDir, 'work.json')

  try {
    const { imports, tasks } = JSON.parse(await Deno.readTextFile(join(denoDir, 'deno.json')))

    await writeFixture({ directory: cwd, runPath: join(scriptsDir, 'work-run.ts'), calls: 10 })
    await Deno.writeTextFile(join(cwd, 'deno.json'), JSON.stringify({ imports, tasks }))
    for (const name of ['work.ts', 'api-surface.ts']) {
      await Deno.copyFile(join(denoDir, '.scripts', name), join(scriptsDir, name))
    }

    const recording = await runTask({ name: 'record-work', cwd })
    assertEquals(recording.code, 0, recording.stderr)
    const recorded = await Deno.readTextFile(workPath)
    const holds = await runTask({ name: 'check-work', cwd })
    assertEquals(holds.code, 0, holds.stderr)

    await writeFixture({ directory: cwd, runPath: join(scriptsDir, 'work-run.ts'), calls: 20 })
    const moved = await runTask({ name: 'check-work', cwd })
    assertEquals(moved.code, 1, moved.stderr)
    assertStringIncludes(moved.stderr, 'core/visit.ts visit: 10 -> 20')
    assertEquals(await Deno.readTextFile(workPath), recorded)

    await Deno.remove(workPath)
    const missing = await runTask({ name: 'check-work', cwd })
    assertEquals(missing.code, 1, missing.stderr)
    assertStringIncludes(missing.stderr, 'missing, malformed or empty')
    await assertRejects(() => Deno.stat(workPath), Deno.errors.NotFound)
  } finally {
    await Deno.remove(cwd, { recursive: true })
  }
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
  const url = 'file:///deno/core/a.ts'

  assertThrows(
    () => collectCalls([{ url }], 'file:///deno/'),
    Error,
    'its format changed'
  )
  assertThrows(
    () =>
      collectCalls([{ url, functions: [{ functionName: 'a', ranges: [] }] }], 'file:///deno/'),
    Error,
    'has no name or no count'
  )
})

Deno.test('the record has the functions called more than 5 times a file, rounded and by name', () => {
  const calls = new Map([
    ['core/b.ts often', 1249],
    ['core/a.ts often', 1251],
    // 955 is the limit of 191 files: not recorded, though it rounds to 960.
    ['core/a.ts limit', 955]
  ])
  const functions = toRecordedFunctions(calls, 191)

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
