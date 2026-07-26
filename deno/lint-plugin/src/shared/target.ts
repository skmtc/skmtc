/**
 * Which files the rules apply to.
 *
 * The gen-eval fact pass scopes itself to the code the worker bundle
 * executes — root entry files plus `src/**`, excluding tests, `demo/`,
 * `scripts/` and `examples/` — because those excluded trees legitimately
 * do the things the rules forbid: a demo runner awaits and reads files, a
 * test builds a `{ toString }` double and casts with `as`.
 *
 * A lint rule sees one absolute filename and cannot locate the package
 * root, so the scope is approximated by path shape instead. The
 * approximation is deliberately loose in one direction only: it may skip
 * a file the harness would have read (a generator that happens to live
 * under a directory named `tests`), never the reverse. Consumers narrow
 * further with `lint.exclude` in `deno.json`.
 */

const EXCLUDED_SEGMENTS = new Set([
  'node_modules',
  'coverage',
  'dist',
  'demo',
  'demos',
  'example',
  'examples',
  'scripts',
  'test',
  'tests',
  '__tests__',
  'fixtures'
])

const TEST_FILE = /\.(test|spec|bench)\.[cm]?[jt]sx?$/

// Dot-directories inside a generator hold its own tooling (`.scripts`
// build scripts, `.github` workflows) and are out of scope like `scripts/`.
// `.skmtc` is the exception: it is the project workspace root, so every
// generator in a real project lives BELOW a dot-segment.
const IN_SCOPE_DOT_SEGMENT = '.skmtc'

const isExcludedSegment = (segment: string): boolean =>
  EXCLUDED_SEGMENTS.has(segment) || (segment.startsWith('.') && segment !== IN_SCOPE_DOT_SEGMENT)

/**
 * True when a rule should run against this file. Applied uniformly by
 * every rule, so a rule body never repeats the scope question.
 */
export const isGeneratorSource = (filename: string): boolean => {
  const segments = filename.split('/')
  const basename = segments.at(-1) ?? ''
  return !TEST_FILE.test(basename) && !segments.slice(0, -1).some(isExcludedSegment)
}
