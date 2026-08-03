#!/usr/bin/env node
// Scores a task1k run workspace. Usage: node score1k.mjs <workspaceDir>
// Writes <workspaceDir>/score.json and prints a summary.
//
// Metrics (PLAN C-EXP): verify exit, artifacts present, duplicate
// definitions, unresolved imports (via deno check), skmtc lint firings,
// gen-eval report (incl. check 4 string-composition outside share).

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const workspace = resolve(process.argv[2] ?? '.')
const GEN_EVAL_CLI =
  '/Users/dmitrigrabov/workspace/skmtc-root/skmtc/packages/gen-eval/src/cli.ts'
const EXPECTED_MODELS = ['Order', 'OrderItem', 'OrderStatus', 'Address', 'Category']

const run = (cmd, args, options = {}) => {
  try {
    const stdout = execFileSync(cmd, args, {
      cwd: workspace,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300_000,
      ...options
    })
    return { ok: true, output: stdout }
  } catch (error) {
    return { ok: false, output: `${error.stdout ?? ''}${error.stderr ?? ''}${error.message}` }
  }
}

const score = { workspace, timestamp: null }

// 1. verify (engine run + typecheck of artifacts)
const verify = run('deno', ['task', 'verify'])
score.verifyPassed = verify.ok
score.verifyTail = verify.output.split('\n').slice(-12).join('\n')

// 2. expected artifacts
const outDir = join(workspace, 'out', 'com', 'example', 'models')
const outFiles = existsSync(outDir) ? readdirSync(outDir) : []
score.artifacts = outFiles
score.expectedModelsPresent = EXPECTED_MODELS.filter(model =>
  outFiles.some(file => file.toLowerCase().startsWith(model.toLowerCase()))
)
score.allModelsPresent = score.expectedModelsPresent.length === EXPECTED_MODELS.length

// 3. duplicate definitions across artifacts (each model defined exactly once)
const definitionCounts = {}
for (const file of outFiles) {
  const text = readFileSync(join(outDir, file), 'utf8')
  for (const match of text.matchAll(/(?:data class|enum class|class|interface|typealias)\s+(\w+)/g)) {
    definitionCounts[match[1]] = (definitionCounts[match[1]] ?? 0) + 1
  }
}
score.duplicateDefinitions = Object.entries(definitionCounts)
  .filter(([, count]) => count > 1)
  .map(([name, count]) => `${name}×${count}`)

// 4. Jackson wire-name mapping present where names were converted
const itemFile = outFiles.find(file => file.toLowerCase().startsWith('orderitem.'))
score.jacksonAnnotated = itemFile
  ? readFileSync(join(outDir, itemFile), 'utf8').includes('@JsonProperty("unit_price")')
  : false

// 5. skmtc lint over the authored generator (deno lint exits non-zero on
// findings, so capture stdout from the thrown error too)
let lintStdout = ''
try {
  lintStdout = execFileSync('deno', ['lint', '--json', 'gen-kotlin-jackson/'], {
    cwd: workspace,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000
  })
} catch (error) {
  lintStdout = error.stdout ?? ''
}
try {
  const diagnostics = JSON.parse(lintStdout).diagnostics ?? []
  score.lintSkmtcFirings = diagnostics
    .filter(d => String(d.code ?? '').startsWith('skmtc/'))
    .map(d => `${d.code}@${d.filename?.split('/').pop()}`)
  score.lintTotal = diagnostics.length
} catch {
  score.lintSkmtcFirings = null
}

// 6. gen-eval structural report
const genEvalJson = join(workspace, 'gen-eval-report.json')
const genEval = run('node', [GEN_EVAL_CLI, 'gen-kotlin-jackson', '--json', genEvalJson])
if (existsSync(genEvalJson)) {
  try {
    const report = JSON.parse(readFileSync(genEvalJson, 'utf8'))
    const top = Array.isArray(report) ? report[0] : report
    score.genEval = {
      structurePass: top.structure?.pass ?? null,
      producerShare: top.producerShare ?? null,
      stringOutsideShare: top.strings?.outsideShare ?? null,
      stringTopOutsideSites: (top.strings?.topOutsideSites ?? []).slice(0, 5),
      templateImportsPass: top.templateImports?.pass ?? null,
      adHocToStringPass: top.adHocToString?.pass ?? null,
      methodDiscipline: {
        producers: top.methodDiscipline?.producers ?? null,
        clean: top.methodDiscipline?.clean ?? null
      },
      aggregateVerdict: top.aggregate?.verdict ?? null
    }
  } catch {
    score.genEval = null
  }
} else {
  score.genEval = null
  score.genEvalTail = genEval.output.split('\n').slice(-6).join('\n')
}

// 7. skeleton adoption (EXP-5 process metric): did the agent copy the
// skmtc-model-v3 skeleton? SLOT markers + the single-point lib.ts are
// its fingerprints. Reported, never gated.
const genDir = join(workspace, 'gen-kotlin-jackson')
let slotMarkers = 0
let hasLibTs = false
if (existsSync(genDir)) {
  const walk = dir =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
    )
  for (const file of walk(genDir).filter(f => f.endsWith('.ts'))) {
    slotMarkers += (readFileSync(file, 'utf8').match(/SLOT\(/g) ?? []).length
    if (file.endsWith('/lib.ts')) hasLibTs = true
  }
}
score.skeletonAdoption = { slotMarkers, hasLibTs, adopted: slotMarkers >= 5 && hasLibTs }

// 8. recursion outcome: Category must self-reference lazily, not crash/inline
const categoryFile = outFiles.find(file => file.toLowerCase().startsWith('category.'))
score.categoryRecursion = categoryFile
  ? /children: List<Category>\? = null/.test(readFileSync(join(outDir, categoryFile), 'utf8'))
  : false

score.timestamp = new Date().toISOString()

writeFileSync(join(workspace, 'score.json'), JSON.stringify(score, null, 2))

const flag = value => (value ? 'PASS' : 'FAIL')
console.log(`verify:            ${flag(score.verifyPassed)}`)
console.log(`all models:        ${flag(score.allModelsPresent)} (${score.expectedModelsPresent.join(', ')})`)
console.log(`no duplicates:     ${flag(score.duplicateDefinitions.length === 0)} ${score.duplicateDefinitions.join(' ')}`)
console.log(`@JsonProperty:     ${flag(score.jacksonAnnotated)}`)
console.log(`skmtc lint clean:  ${score.lintSkmtcFirings === null ? 'n/a' : flag(score.lintSkmtcFirings.length === 0)} ${(score.lintSkmtcFirings ?? []).join(' ')}`)
console.log(`gen-eval:          ${score.genEval ? 'report written' : 'unavailable'}`)
console.log(`recursion (lazy):  ${flag(score.categoryRecursion)}`)
console.log(`skeleton adopted:  ${score.skeletonAdoption.adopted} (${score.skeletonAdoption.slotMarkers} SLOT markers, lib.ts: ${score.skeletonAdoption.hasLibTs})`)
