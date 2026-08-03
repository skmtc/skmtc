#!/usr/bin/env node
// Scores a task-2 (gen-api-client) run workspace.
// Usage: node score2.mjs <workspaceDir>

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const workspace = resolve(process.argv[2] ?? '.')
const GEN_EVAL_CLI =
  '/Users/dmitrigrabov/workspace/skmtc-root/skmtc/packages/gen-eval/src/cli.ts'

const run = (cmd, args) => {
  try {
    const stdout = execFileSync(cmd, args, {
      cwd: workspace,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300_000
    })
    return { ok: true, output: stdout }
  } catch (error) {
    return { ok: false, output: `${error.stdout ?? ''}${error.stderr ?? ''}${error.message}` }
  }
}

const readAll = dir => {
  if (!existsSync(dir)) return {}
  const files = {}
  for (const name of readdirSync(dir)) {
    if (name.endsWith('.ts')) files[name] = readFileSync(join(dir, name), 'utf8')
  }
  return files
}

const score = { workspace }

// 1. verify
const verify = run('deno', ['task', 'verify'])
score.verifyPassed = verify.ok
score.verifyTail = verify.output.split('\n').slice(-10).join('\n')

// 2. expected client files with accumulator shape
const clientFiles = readAll(join(workspace, 'out', 'client'))
const orders = Object.entries(clientFiles).find(([n]) => n.toLowerCase().includes('order'))?.[1] ?? ''
const addresses = Object.entries(clientFiles).find(([n]) => n.toLowerCase().includes('address'))?.[1] ?? ''
score.clientFiles = Object.keys(clientFiles)
score.ordersClass = (orders.match(/export\s+class\s+\w+/g) ?? []).length
score.ordersMethods = (orders.match(/async\s+\w+\s*\(/g) ?? []).length
score.addressesClass = (addresses.match(/export\s+class\s+\w+/g) ?? []).length
score.addressesMethods = (addresses.match(/async\s+\w+\s*\(/g) ?? []).length
score.accumulatorShape =
  score.ordersClass === 1 && score.ordersMethods >= 3 &&
  score.addressesClass === 1 && score.addressesMethods >= 1

// 3. zod models produced by the engine, defined once, imported into clients
const allOut = {}
const walk = dir => {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p)
    else if (entry.name.endsWith('.ts')) allOut[p] = readFileSync(p, 'utf8')
  }
}
walk(join(workspace, 'out'))
const definitionCounts = {}
for (const text of Object.values(allOut)) {
  for (const match of text.matchAll(/export\s+(?:const|type|class)\s+(\w+)/g)) {
    definitionCounts[match[1]] = (definitionCounts[match[1]] ?? 0) + 1
  }
}
score.duplicateDefinitions = Object.entries(definitionCounts)
  .filter(([, count]) => count > 1)
  .map(([name, count]) => `${name}×${count}`)
score.zodModelFilesExist = Object.keys(allOut).some(p => /order\w*\.generated\.ts$/i.test(p) && !p.includes('client'))
score.clientImportsModels = /import\s*\{[^}]*\}\s*from\s*'@\//.test(orders)
score.usesZodParse = /\.parse\(await\s+res\.json\(\)\)/.test(orders) && /\.parse\(await\s+res\.json\(\)\)/.test(addresses)

// 4. skmtc lint over the authored generator
let lintStdout = ''
try {
  lintStdout = execFileSync('deno', ['lint', '--json', 'gen-api-client/'], {
    cwd: workspace, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000
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

// 5. gen-eval
const genEvalJson = join(workspace, 'gen-eval-report.json')
run('node', [GEN_EVAL_CLI, 'gen-api-client', '--json', genEvalJson])
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
      accumulatorVerdict: top.accumulator ?? null,
      aggregateVerdict: top.aggregate?.verdict ?? null
    }
  } catch {
    score.genEval = null
  }
}

score.timestamp = new Date().toISOString()
writeFileSync(join(workspace, 'score.json'), JSON.stringify(score, null, 2))

const flag = value => (value ? 'PASS' : 'FAIL')
console.log(`verify:             ${flag(score.verifyPassed)}`)
console.log(`accumulator shape:  ${flag(score.accumulatorShape)} (orders ${score.ordersClass}c/${score.ordersMethods}m, addresses ${score.addressesClass}c/${score.addressesMethods}m)`)
console.log(`no duplicates:      ${flag(score.duplicateDefinitions.length === 0)} ${score.duplicateDefinitions.join(' ')}`)
console.log(`zod via engine:     ${flag(score.zodModelFilesExist && score.clientImportsModels && score.usesZodParse)}`)
console.log(`skmtc lint clean:   ${score.lintSkmtcFirings === null ? 'n/a' : flag(score.lintSkmtcFirings.length === 0)} ${(score.lintSkmtcFirings ?? []).join(' ')}`)
console.log(`gen-eval:           ${score.genEval ? `oS ${score.genEval.stringOutsideShare?.toFixed(3)} verdict ${score.genEval.aggregateVerdict}` : 'unavailable'}`)
