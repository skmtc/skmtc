/**
 * Graders for the docs eval harness. Mechanical kinds first
 * (`file-exists`, `file-contains`, `run-command`); `llm-judge` is
 * reserved for qualitative outcomes a mechanical check can't reach.
 *
 * Every grader returns a `GraderResult` — the harness ANDs them: a
 * trial passes only when every grader passes.
 */

import { join } from 'jsr:@std/path@^1'

export type GraderSpec =
  | { kind: 'file-exists'; path: string }
  | { kind: 'file-contains'; path: string; pattern: string }
  | { kind: 'run-command'; cmd: string; args?: string[]; expectExit?: number }
  | { kind: 'llm-judge'; rubric: string }

export type GraderResult = {
  kind: string
  pass: boolean
  detail: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string')

export const parseGraderSpec = (value: unknown, context: string): GraderSpec => {
  if (!isRecord(value)) {
    throw new Error(`${context}: grader spec must be an object`)
  }

  switch (value.kind) {
    case 'file-exists': {
      if (typeof value.path !== 'string') {
        throw new Error(`${context}: file-exists grader needs a string 'path'`)
      }
      return { kind: 'file-exists', path: value.path }
    }
    case 'file-contains': {
      if (typeof value.path !== 'string' || typeof value.pattern !== 'string') {
        throw new Error(`${context}: file-contains grader needs string 'path' and 'pattern'`)
      }
      return { kind: 'file-contains', path: value.path, pattern: value.pattern }
    }
    case 'run-command': {
      if (typeof value.cmd !== 'string') {
        throw new Error(`${context}: run-command grader needs a string 'cmd'`)
      }
      if (value.args !== undefined && !isStringArray(value.args)) {
        throw new Error(`${context}: run-command 'args' must be a string array`)
      }
      if (value.expectExit !== undefined && typeof value.expectExit !== 'number') {
        throw new Error(`${context}: run-command 'expectExit' must be a number`)
      }
      return {
        kind: 'run-command',
        cmd: value.cmd,
        args: isStringArray(value.args) ? value.args : undefined,
        expectExit: typeof value.expectExit === 'number' ? value.expectExit : undefined
      }
    }
    case 'llm-judge': {
      if (typeof value.rubric !== 'string') {
        throw new Error(`${context}: llm-judge grader needs a string 'rubric'`)
      }
      return { kind: 'llm-judge', rubric: value.rubric }
    }
    default: {
      throw new Error(`${context}: unknown grader kind '${String(value.kind)}'`)
    }
  }
}

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max)}…`

const gradeFileExists = async (sandbox: string, path: string): Promise<GraderResult> => {
  try {
    const stat = await Deno.stat(join(sandbox, path))
    return {
      kind: 'file-exists',
      pass: stat.isFile,
      detail: stat.isFile ? `${path} exists` : `${path} exists but is not a file`
    }
  } catch {
    return { kind: 'file-exists', pass: false, detail: `${path} not found` }
  }
}

const gradeFileContains = async (
  sandbox: string,
  path: string,
  pattern: string
): Promise<GraderResult> => {
  try {
    const content = await Deno.readTextFile(join(sandbox, path))
    const matched = new RegExp(pattern, 'm').test(content)
    return {
      kind: 'file-contains',
      pass: matched,
      detail: matched
        ? `${path} matches /${pattern}/`
        : `${path} does not match /${pattern}/ (content: ${truncate(content.trim(), 200)})`
    }
  } catch {
    return { kind: 'file-contains', pass: false, detail: `${path} not readable` }
  }
}

const gradeRunCommand = async (
  sandbox: string,
  cmd: string,
  args: string[],
  expectExit: number
): Promise<GraderResult> => {
  try {
    const output = await new Deno.Command(cmd, {
      args,
      cwd: sandbox,
      stdout: 'piped',
      stderr: 'piped'
    }).output()

    const stderr = new TextDecoder().decode(output.stderr)
    const stdout = new TextDecoder().decode(output.stdout)
    const pass = output.code === expectExit

    return {
      kind: 'run-command',
      pass,
      detail: pass
        ? `${cmd} ${args.join(' ')} exited ${output.code}`
        : `${cmd} ${args.join(' ')} exited ${output.code} (expected ${expectExit}): ${truncate(
            `${stdout} ${stderr}`.trim(),
            400
          )}`
    }
  } catch (error) {
    return {
      kind: 'run-command',
      pass: false,
      detail: `failed to spawn ${cmd}: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

const extractJsonObject = (text: string): unknown => {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('no JSON object in judge reply')
  return JSON.parse(match[0])
}

const gradeLlmJudge = async (
  rubric: string,
  finalMessage: string,
  judgeModel: string
): Promise<GraderResult> => {
  const prompt = [
    'You are grading the final answer an AI agent gave at the end of a task.',
    'Apply the rubric below strictly. Do not give credit for effort or partial work.',
    '',
    `<rubric>${rubric}</rubric>`,
    '',
    `<agent-final-answer>${finalMessage}</agent-final-answer>`,
    '',
    'Reply with ONLY a JSON object of the shape {"pass": boolean, "reason": string}.'
  ].join('\n')

  try {
    const output = await new Deno.Command('claude', {
      args: ['-p', prompt, '--output-format', 'json', '--model', judgeModel, '--max-turns', '1'],
      stdout: 'piped',
      stderr: 'piped'
    }).output()

    const envelope = JSON.parse(new TextDecoder().decode(output.stdout))
    if (!isRecord(envelope) || typeof envelope.result !== 'string') {
      throw new Error('unexpected judge envelope shape')
    }

    const verdict = extractJsonObject(envelope.result)
    if (!isRecord(verdict) || typeof verdict.pass !== 'boolean') {
      throw new Error(`unexpected judge verdict: ${truncate(envelope.result, 200)}`)
    }

    return {
      kind: 'llm-judge',
      pass: verdict.pass,
      detail: typeof verdict.reason === 'string' ? verdict.reason : '(no reason given)'
    }
  } catch (error) {
    return {
      kind: 'llm-judge',
      pass: false,
      detail: `judge failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

export const runGraders = async (args: {
  specs: GraderSpec[]
  sandbox: string
  finalMessage: string
  judgeModel: string
}): Promise<GraderResult[]> => {
  const results: GraderResult[] = []

  for (const spec of args.specs) {
    switch (spec.kind) {
      case 'file-exists': {
        results.push(await gradeFileExists(args.sandbox, spec.path))
        break
      }
      case 'file-contains': {
        results.push(await gradeFileContains(args.sandbox, spec.path, spec.pattern))
        break
      }
      case 'run-command': {
        results.push(
          await gradeRunCommand(args.sandbox, spec.cmd, spec.args ?? [], spec.expectExit ?? 0)
        )
        break
      }
      case 'llm-judge': {
        results.push(await gradeLlmJudge(spec.rubric, args.finalMessage, args.judgeModel))
        break
      }
      default: {
        const _exhaustive: never = spec
        throw new Error(`Unhandled grader: ${JSON.stringify(_exhaustive)}`)
      }
    }
  }

  return results
}
