/**
 * Experiment harness: runs the generator under test over the fixture
 * through the REAL SKMTC pipeline (parse → generate → render), writes the
 * artifacts to ./out/, and saves capture.json ({artifacts, inspection})
 * plus manifest.json for scoring and inspection tooling.
 *
 * Invoked via `deno task generate` / `deno task verify`. Not part of the
 * task deliverable — do not edit.
 */
import { StackTrail, toArtifacts } from '@skmtc/core'
import type { SkmtcDocumentInput } from '@skmtc/core'
import { dirname, fromFileUrl } from '@std/path'
import entry from './gen-effect-schema/mod.ts'

const here = dirname(fromFileUrl(import.meta.url))

const raw: unknown = JSON.parse(await Deno.readTextFile(`${here}/fixture/openapi.json`))

// Test-infra cast: the fixture is authored as a valid OpenAPI 3.0 document.
const document = { type: 'oas', value: raw } as SkmtcDocumentInput

const toGeneratorConfigMap = (() => ({ [entry.id]: entry })) as Parameters<
  typeof toArtifacts
>[0]['toGeneratorConfigMap']

const result = toArtifacts({
  traceId: 'exp',
  spanId: 'exp',
  document,
  settings: undefined,
  toGeneratorConfigMap,
  stackTrail: StackTrail.empty(),
  startAt: Date.now(),
  silent: true,
  inspect: true
})

const outRoot = `${here}/out`
await Deno.remove(outRoot, { recursive: true }).catch(() => {})

const written: string[] = []
for (const [key, content] of Object.entries(result.artifacts)) {
  const rel = key.replace(/^@\/?/, '')
  const path = `${outRoot}/${rel}`
  await Deno.mkdir(dirname(path), { recursive: true })
  await Deno.writeTextFile(path, content)
  written.push(rel)
}

await Deno.writeTextFile(
  `${here}/capture.json`,
  JSON.stringify({ artifacts: result.artifacts, inspection: result.inspection ?? null }, null, 2)
)
await Deno.writeTextFile(`${here}/manifest.json`, JSON.stringify(result.manifest, null, 2))

// manifest.results is a nested tree (phase → generator → subject → variant)
// whose leaves are status strings — count the leaves.
const resultCounts: Record<string, number> = {}
const countLeaves = (node: unknown): void => {
  if (typeof node === 'string') {
    resultCounts[node] = (resultCounts[node] ?? 0) + 1
    return
  }
  if (node !== null && typeof node === 'object') {
    Object.values(node).forEach(countLeaves)
  }
}
countLeaves(result.manifest.results ?? {})
const parseIssues = result.manifest.parseIssues ?? []

console.log(`artifacts written to out/: ${written.length}`)
for (const rel of written.sort()) console.log(`  ${rel}`)
console.log(`results: ${JSON.stringify(resultCounts)}`)
console.log(`parseIssues: ${Array.isArray(parseIssues) ? parseIssues.length : 'n/a'}`)

if (written.length === 0) {
  console.error('FAIL: the run produced zero artifacts')
  Deno.exit(1)
}
if (resultCounts['error']) {
  console.error(`FAIL: ${resultCounts['error']} subject(s) errored — see manifest.json`)
  Deno.exit(1)
}
