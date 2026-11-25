#!/usr/bin/env -S deno run --no-lock --node-modules-dir=none --allow-read --allow-write --allow-run=deno
/**
 * How often each function of core and lang-typescript is called in one fixed
 * run (`work-run.ts`), recorded in `work.json`.
 *
 * Tests and reviews check the output of a run, so a change that does the same
 * work many times over passes them. V8 coverage counts the calls of every
 * function. The check runs the document again and fails when a count moved,
 * up or down.
 *
 * The record has the functions called more than {@link CALLS_PER_FILE} times
 * for each generated file, with the count rounded to two significant digits,
 * so a small change moves it only where a count is next to a rounding step. A
 * function with no name is left out, and functions of one name in one file are
 * added up.
 *
 * Not covered, so a green check is not read as more than it is: a function
 * that gets slower with the same number of calls, one that stays below the
 * limit however much it grew, work inside built-ins such as a regular
 * expression, and the generators, which are in their own repository.
 *
 * Run from `deno/`: `deno task record-work` and `deno task check-work`.
 */

import { fromFileUrl, join, toFileUrl } from '@std/path'
import { isRecord, runDeno, spawnedDenoVersion } from './api-surface.ts'

/** The packages whose functions are counted, by directory. */
const countedDirectories = ['core', 'lang-typescript']

const CALLS_PER_FILE = 5

const RECORD_WORK = 'deno task record-work'

export type WorkRecord = {
  /** The `deno` that counted. Another V8 can name or count functions differently. */
  deno: string
  /** `<file> <function>` to its rounded number of calls. */
  functions: Record<string, number>
}

/** What a run counted. */
export type Work = {
  record: WorkRecord
  /** The calls of every named function of the run, in the record or not. */
  calls: Map<string, number>
}

export type MovedFunction = {
  name: string
  /** `undefined`: the function is not in the record. */
  recorded: number | undefined
  current: number
}

/** Whether a parsed record has the shape {@link WorkRecord}. */
export const isWorkRecord = (value: unknown): value is WorkRecord =>
  isRecord(value) &&
  typeof value.deno === 'string' &&
  isRecord(value.functions) &&
  Object.values(value.functions).every(count => typeof count === 'number')

const isList = (value: unknown): value is unknown[] => Array.isArray(value)

/**
 * The calls of each named function in the coverage files of one run, by
 * `<file> <function>`. Only scripts in a counted directory under `rootUrl`,
 * which ends with a slash, count.
 */
export const collectCalls = (scripts: unknown[], rootUrl: string): Map<string, number> => {
  const calls = new Map<string, number>()

  for (const script of scripts) {
    if (!isRecord(script) || typeof script.url !== 'string' || !isList(script.functions)) {
      throw new Error('a coverage file has no `url` or no `functions`: its format changed')
    }

    if (!script.url.startsWith(rootUrl)) continue
    const file = script.url.slice(rootUrl.length)
    if (!countedDirectories.some(directory => file.startsWith(`${directory}/`))) continue

    for (const entry of script.functions) {
      const ranges = isRecord(entry) && isList(entry.ranges) ? entry.ranges : []
      // The first range is the whole function; the others are blocks in it.
      const whole = ranges[0]

      if (
        !isRecord(entry) ||
        typeof entry.functionName !== 'string' ||
        !isRecord(whole) ||
        typeof whole.count !== 'number'
      ) {
        throw new Error(`a function in the coverage of ${file} has no name or no count`)
      }

      if (entry.functionName === '') continue

      const name = `${file} ${entry.functionName}`
      calls.set(name, (calls.get(name) ?? 0) + whole.count)
    }
  }

  return calls
}

export const roundCount = (count: number): number => Number(count.toPrecision(2))

/** The functions called often enough in a run of `files` generated files, by name. */
export const toRecordedFunctions = (
  calls: Map<string, number>,
  files: number
): Record<string, number> =>
  Object.fromEntries(
    [...calls]
      .filter(([, count]) => count > CALLS_PER_FILE * files)
      .map(([name, count]): [string, number] => [name, roundCount(count)])
      .sort(([a], [b]) => (a < b ? -1 : 1))
  )

const readFileCount = (output: string): number => {
  const files = Number(output.match(/^\{"files":(\d+)\}\s*$/)?.[1] ?? 0)

  if (files === 0) {
    throw new Error(`the run did not print a positive number of generated files: ${output}`)
  }

  return files
}

const readCoverage = async (directory: string): Promise<unknown[]> => {
  const entries = await Array.fromAsync(Deno.readDir(directory))

  return await Promise.all(
    entries
      .filter(({ name }) => name.endsWith('.json'))
      .map(async ({ name }) => JSON.parse(await Deno.readTextFile(join(directory, name))))
  )
}

type ComputeWorkArgs = {
  /** The directory that holds the counted directories. */
  denoDir: string
  runPath: string
}

/** Start the run in its own process, as coverage needs, and count its calls. */
export const computeWork = async ({ denoDir, runPath }: ComputeWorkArgs): Promise<Work> => {
  const coverageDir = await Deno.makeTempDir({ prefix: 'skmtc-work-' })

  try {
    const deno = await spawnedDenoVersion()
    const output = await runDeno([
      'run',
      '--quiet',
      // Writes neither deno.lock nor node_modules: without the lock, npm
      // packages resolve to other versions than the tests load.
      '--no-lock',
      '--node-modules-dir=none',
      '--allow-read',
      '--allow-env',
      `--coverage=${coverageDir}`,
      runPath
    ])

    // With one slash at the end, whether `denoDir` has one or not. Coverage names
    // a script by the path it was started with, so links are not resolved.
    const rootUrl = toFileUrl(join(denoDir, '/')).href
    const calls = collectCalls(await readCoverage(coverageDir), rootUrl)
    const functions = toRecordedFunctions(calls, readFileCount(output))

    if (Object.keys(functions).length === 0) {
      throw new Error(
        `no function of ${countedDirectories.join(' or ')} under ${rootUrl} was called often ` +
          'enough to record'
      )
    }

    return { record: { deno, functions }, calls }
  } finally {
    await Deno.remove(coverageDir, { recursive: true })
  }
}

/** Each function of either record whose rounded count is not the recorded one. */
export const diffWork = (
  recorded: Record<string, number>,
  { record, calls }: Work
): MovedFunction[] =>
  [...new Set([...Object.keys(recorded), ...Object.keys(record.functions)])]
    .sort()
    .map(name => ({
      name,
      recorded: recorded[name],
      current: roundCount(calls.get(name) ?? 0)
    }))
    .filter(({ recorded, current }) => recorded !== current)

/** What fails the check, one line each. Empty when the record holds. */
export const checkWork = (recorded: unknown, current: Work): string[] => {
  if (!isWorkRecord(recorded) || Object.keys(recorded.functions).length === 0) {
    return [`.scripts/work.json is missing, malformed or empty. Run \`${RECORD_WORK}\`.`]
  }

  const moved = diffWork(recorded.functions, current)

  if (moved.length === 0) return []

  const { deno } = current.record

  return [
    `The number of calls moved for ${moved.length} function(s):`,
    ...moved.map(
      ({ name, recorded, current }) => `  ${name}: ${recorded ?? 'not in the record'} -> ${current}`
    ),
    recorded.deno === deno
      ? `If the change is meant, run \`${RECORD_WORK}\` and commit .scripts/work.json.`
      : `The record was made with deno ${recorded.deno} and this is deno ${deno}, which can ` +
        `count differently. Run \`${RECORD_WORK}\` with deno ${deno} on a commit whose code ` +
        'did not change, then run this check again.'
  ]
}

const toRecordPath = (denoDir: string): string => join(denoDir, '.scripts', 'work.json')

const readRecord = async (denoDir: string): Promise<unknown> => {
  try {
    return JSON.parse(await Deno.readTextFile(toRecordPath(denoDir)))
  } catch (error) {
    if (error instanceof Deno.errors.NotFound || error instanceof SyntaxError) return undefined
    throw error
  }
}

if (import.meta.main) {
  const denoDir = fromFileUrl(new URL('..', import.meta.url))
  const work = await computeWork({ denoDir, runPath: join(denoDir, '.scripts', 'work-run.ts') })
  const summary = `${Object.keys(work.record.functions).length} functions, deno ${work.record.deno}`

  if (Deno.args.includes('--check')) {
    const problems = checkWork(await readRecord(denoDir), work)

    problems.forEach(problem => console.error(problem))
    if (problems.length > 0) Deno.exit(1)

    console.log(`work: the record holds (${summary})`)
  } else {
    await Deno.writeTextFile(toRecordPath(denoDir), `${JSON.stringify(work.record, null, 2)}\n`)
    console.log(`wrote .scripts/work.json (${summary})`)
  }
}
