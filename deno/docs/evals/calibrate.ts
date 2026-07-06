#!/usr/bin/env -S deno run -A
/**
 * Grader calibration — every grader kind must produce the correct
 * verdict on one known-good and one known-bad case before its task's
 * numbers are trusted (plan decision 5).
 *
 * Mechanical kinds are exercised against a synthetic sandbox; the
 * llm-judge kind makes two live judge calls (haiku, ~$0.01).
 *
 * Usage: deno run -A calibrate.ts [--skip-judge]
 * Exit 0 = all verdicts correct.
 */

import { parseArgs } from 'jsr:@std/cli@^1/parse-args'
import { join } from 'jsr:@std/path@^1'
import { runGraders, type GraderSpec } from './graders.ts'

const flags = parseArgs(Deno.args, { boolean: ['skip-judge'] })

const sandbox = await Deno.makeTempDir({ prefix: 'skmtc-eval-calibration-' })
await Deno.writeTextFile(join(sandbox, 'present.txt'), 'the codeword is ZEPHYR-42\n')

type Case = {
  name: string
  spec: GraderSpec
  finalMessage: string
  expectPass: boolean
}

const mechanicalCases: Case[] = [
  {
    name: 'file-exists / present',
    spec: { kind: 'file-exists', path: 'present.txt' },
    finalMessage: '',
    expectPass: true
  },
  {
    name: 'file-exists / absent',
    spec: { kind: 'file-exists', path: 'absent.txt' },
    finalMessage: '',
    expectPass: false
  },
  {
    name: 'file-contains / matching',
    spec: { kind: 'file-contains', path: 'present.txt', pattern: 'ZEPHYR-42' },
    finalMessage: '',
    expectPass: true
  },
  {
    name: 'file-contains / non-matching',
    spec: { kind: 'file-contains', path: 'present.txt', pattern: 'WRONG-99' },
    finalMessage: '',
    expectPass: false
  },
  {
    name: 'run-command / exit 0',
    spec: { kind: 'run-command', cmd: 'true' },
    finalMessage: '',
    expectPass: true
  },
  {
    name: 'run-command / exit 1',
    spec: { kind: 'run-command', cmd: 'false' },
    finalMessage: '',
    expectPass: false
  }
]

const judgeRubric =
  'Pass only if the answer states that the root cause is a stale bundle ' +
  '(bundle.js not rebuilt after the generator source changed).'

const judgeCases: Case[] = [
  {
    name: 'llm-judge / correct diagnosis',
    spec: { kind: 'llm-judge', rubric: judgeRubric },
    finalMessage:
      'The generator output was stale because bundle.js was not rebuilt after ' +
      'the source edit — the stale bundle kept serving the old generator. ' +
      'Running `skmtc bundle` fixed it.',
    expectPass: true
  },
  {
    name: 'llm-judge / wrong diagnosis',
    spec: { kind: 'llm-judge', rubric: judgeRubric },
    finalMessage:
      'The output was missing because the OpenAPI schema had a broken $ref, ' +
      'so the parser dropped the model.',
    expectPass: false
  }
]

const cases = flags['skip-judge'] ? mechanicalCases : [...mechanicalCases, ...judgeCases]

let failures = 0

for (const testCase of cases) {
  const [result] = await runGraders({
    specs: [testCase.spec],
    sandbox,
    finalMessage: testCase.finalMessage,
    judgeModel: 'haiku'
  })

  const correct = result.pass === testCase.expectPass
  console.log(
    `${correct ? 'ok  ' : 'FAIL'}  ${testCase.name} → ${result.pass ? 'pass' : 'fail'} (${result.detail})`
  )
  if (!correct) failures++
}

await Deno.remove(sandbox, { recursive: true })

if (failures > 0) {
  console.error(`\n${failures} calibration case(s) wrong`)
  Deno.exit(1)
}
console.log('\nall grader verdicts correct')
