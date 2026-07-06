#!/usr/bin/env -S deno run -A
/**
 * Docs eval harness — cold-agent evals for SKMTC docs/skills.
 *
 * Spawns a headless `claude -p` agent per trial inside a throwaway
 * sandbox containing only fixture files + snapshots of the docs under
 * test, then grades the outcome (see graders.ts). Pass-rate is the
 * docs' quality metric; turns/cost-to-success is the tiebreaker.
 *
 * Usage:
 *   deno run -A run.ts                          # all tasks, 1 trial each
 *   deno run -A run.ts --task smoke --trials 3
 *   deno run -A run.ts --task diagnose-skipped-output --no-docs   # contamination control
 *   deno run -A run.ts --label before-rewrite --trials 3
 *
 * Flags:
 *   --task <id>         task to run (repeatable / comma-separated; default all)
 *   --trials <n>        trials per task (default 1)
 *   --no-docs           omit the docs snapshot (contamination control)
 *   --label <name>      run label; results land in results/<label>.jsonl
 *   --model <m>         doer model (default sonnet)
 *   --judge-model <m>   judge model for llm-judge graders (default haiku)
 *   --keep-sandbox      keep sandboxes of passing trials too (failures are always kept)
 *
 * Design + task-authoring conventions:
 *   notes/plan-2026-07-05-docs-eval-harness.md
 */

import { parseArgs } from 'jsr:@std/cli@^1/parse-args'
import { parse as parseYaml } from 'jsr:@std/yaml@^1'
import { basename, dirname, fromFileUrl, join } from 'jsr:@std/path@^1'
import { copy } from 'jsr:@std/fs@^1'
import { parseGraderSpec, runGraders, type GraderResult, type GraderSpec } from './graders.ts'

const evalsDir = dirname(fromFileUrl(import.meta.url))
const repoRoot = join(evalsDir, '..', '..', '..')

const AGENT_TIMEOUT_MS = 15 * 60_000

/** Sandboxes run against the local mirror registry with this CLI
 * version — the only self-consistent world today. Public jsr.io is
 * blocked twice over: `deno bundle` fails to load jsr specifiers
 * from jsr.io at all (repro'd standalone on deno 2.9.1, works
 * against the mirror), and jsr.io's gen-* packages are ancient.
 * See the plan's "Environment discoveries". Revisit when either
 * clears; then this shim machinery can go. */
const SANDBOX_CLI_VERSION = '0.9.21'

const SKMTC_PERMS = [
  '--allow-read',
  '--allow-write',
  '--allow-net',
  '--allow-env',
  '--allow-run=deno,sh',
  '--allow-sys=homedir'
]

type Task = {
  id: string
  docs: string[]
  fixture: string | undefined
  maxTurns: number
  graders: GraderSpec[]
  prompt: string
}

type ClaudeEnvelope = {
  isError: boolean
  result: string
  numTurns: number | null
  /** Claude Code's own list-price accounting of the run's token
   * usage (`total_cost_usd`). The spawned agents authenticate with
   * the user's Claude Code OAuth credential — runs are covered by
   * the subscription, so this is NOTIONAL, not billed spend. Kept
   * as a comparable effort metric alongside tokens/turns. */
  notionalUsd: number | null
  outputTokens: number | null
  sessionId: string | null
}

type TrialRow = {
  runLabel: string
  task: string
  trial: number
  docsMode: 'with-docs' | 'no-docs'
  docsSha: string
  model: string
  pass: boolean
  graders: GraderResult[]
  numTurns: number | null
  outputTokens: number | null
  /** Notional list-price accounting from the claude envelope — runs
   * are on the user's subscription; nothing is billed per-run. */
  notionalUsd: number | null
  durationMs: number
  isError: boolean
  timedOut: boolean
  sandbox: string | null
  sessionId: string | null
  finalMessage: string
  timestamp: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const loadTask = async (taskPath: string): Promise<Task> => {
  const raw = await Deno.readTextFile(taskPath)
  const context = basename(taskPath)

  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error(`${context}: missing YAML frontmatter`)

  const frontmatter = parseYaml(match[1])
  if (!isRecord(frontmatter)) throw new Error(`${context}: frontmatter must be a mapping`)

  const { id, docs, fixture, maxTurns, graders } = frontmatter

  if (typeof id !== 'string') throw new Error(`${context}: 'id' must be a string`)
  if (!Array.isArray(docs) || !docs.every(entry => typeof entry === 'string')) {
    throw new Error(`${context}: 'docs' must be a string array (repo-relative paths)`)
  }
  if (fixture !== undefined && typeof fixture !== 'string') {
    throw new Error(`${context}: 'fixture' must be a string when present`)
  }
  if (typeof maxTurns !== 'number') throw new Error(`${context}: 'maxTurns' must be a number`)
  if (!Array.isArray(graders) || graders.length === 0) {
    throw new Error(`${context}: 'graders' must be a non-empty array`)
  }

  const prompt = match[2].trim()
  if (prompt.length === 0) throw new Error(`${context}: prompt body is empty`)

  return {
    id,
    docs: docs.filter((entry): entry is string => typeof entry === 'string'),
    fixture,
    maxTurns,
    graders: graders.map((spec, index) => parseGraderSpec(spec, `${context} graders[${index}]`)),
    prompt
  }
}

const docsSha = async (): Promise<string> => {
  const rev = await new Deno.Command('git', {
    args: ['rev-parse', '--short', 'HEAD'],
    cwd: repoRoot,
    stdout: 'piped',
    stderr: 'piped'
  }).output()
  const sha = new TextDecoder().decode(rev.stdout).trim() || 'unknown'

  const status = await new Deno.Command('git', {
    args: ['status', '--porcelain', '--', 'deno/docs'],
    cwd: repoRoot,
    stdout: 'piped',
    stderr: 'piped'
  }).output()
  const dirty = new TextDecoder().decode(status.stdout).trim().length > 0

  return dirty ? `${sha}-dirty` : sha
}

/** Copy a docs entry into <sandbox>/docs/. A SKILL.md is renamed to
 * <its-directory>.md so the sandbox docs folder reads naturally. */
const copyDocEntry = async (entry: string, sandbox: string): Promise<void> => {
  const source = join(repoRoot, entry)
  const stat = await Deno.stat(source)
  const docsDir = join(sandbox, 'docs')
  await Deno.mkdir(docsDir, { recursive: true })

  if (stat.isDirectory) {
    await copy(source, join(docsDir, basename(entry)), { overwrite: true })
    return
  }

  const name =
    basename(entry) === 'SKILL.md' ? `${basename(dirname(entry))}.md` : basename(entry)
  await Deno.copyFile(source, join(docsDir, name))
}

/** Seed the fresh config dir with working credentials. A fresh
 * CLAUDE_CONFIG_DIR does NOT inherit auth (verified 2026-07-05): on
 * macOS the live OAuth token sits in the Keychain, and the custom
 * config dir only reads its own `.credentials.json`. So: keychain
 * blob first, `~/.claude/.credentials.json` copy as the fallback.
 * The caller must scrub the config dir after the run — sandboxes can
 * be kept for autopsy and must not retain a token. */
const seedCredentials = async (configDir: string): Promise<void> => {
  const target = join(configDir, '.credentials.json')

  if (Deno.build.os === 'darwin') {
    const keychain = await new Deno.Command('security', {
      args: ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
      stdout: 'piped',
      stderr: 'piped'
    }).output()
    if (keychain.success) {
      await Deno.writeTextFile(target, new TextDecoder().decode(keychain.stdout))
      await Deno.chmod(target, 0o600)
      return
    }
  }

  const home = Deno.env.get('HOME')
  if (!home) throw new Error('cannot seed credentials: no keychain entry and no HOME')
  await Deno.copyFile(join(home, '.claude', '.credentials.json'), target)
  await Deno.chmod(target, 0o600)
}

/** Child env for the agent: parent env minus CLAUDE* (nested-session
 * leakage), plus a fresh CLAUDE_CONFIG_DIR for isolation. */
const agentEnv = (configDir: string): Record<string, string> => {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(Deno.env.toObject())) {
    if (key.startsWith('CLAUDE')) continue
    env[key] = value
  }
  env.CLAUDE_CONFIG_DIR = configDir
  return env
}

const parseEnvelope = (stdout: string): ClaudeEnvelope => {
  const parsed = JSON.parse(stdout)
  if (!isRecord(parsed)) throw new Error('claude envelope is not an object')
  // `result` is absent on abnormal terminations (e.g. subtype
  // error_max_turns) — still a valid envelope; the trial fails via
  // is_error but turns/cost must be recorded.
  const usage = isRecord(parsed.usage) ? parsed.usage : {}

  return {
    isError: parsed.is_error === true,
    result:
      typeof parsed.result === 'string'
        ? parsed.result
        : `(no final message; subtype: ${String(parsed.subtype)})`,
    numTurns: typeof parsed.num_turns === 'number' ? parsed.num_turns : null,
    notionalUsd: typeof parsed.total_cost_usd === 'number' ? parsed.total_cost_usd : null,
    outputTokens: typeof usage.output_tokens === 'number' ? usage.output_tokens : null,
    sessionId: typeof parsed.session_id === 'string' ? parsed.session_id : null
  }
}

const spawnAgent = async (args: {
  prompt: string
  sandbox: string
  maxTurns: number
  model: string
}): Promise<{ envelope: ClaudeEnvelope | null; timedOut: boolean; rawStderr: string }> => {
  const configDir = join(args.sandbox, '.claude-config')
  await Deno.mkdir(configDir, { recursive: true })
  await seedCredentials(configDir)

  const child = new Deno.Command('claude', {
    args: [
      '-p',
      args.prompt,
      '--output-format',
      'json',
      '--max-turns',
      String(args.maxTurns),
      '--model',
      args.model,
      '--dangerously-skip-permissions'
    ],
    cwd: args.sandbox,
    clearEnv: true,
    env: agentEnv(configDir),
    stdout: 'piped',
    stderr: 'piped'
  }).spawn()

  const timer = setTimeout(() => {
    try {
      child.kill('SIGKILL')
    } catch {
      // already exited
    }
  }, AGENT_TIMEOUT_MS)

  const output = await child.output()
  clearTimeout(timer)

  // Scrub the seeded credential immediately — the sandbox may be kept
  // for autopsy. The rest of the config dir (transcripts) stays.
  await Deno.remove(join(configDir, '.credentials.json')).catch(() => {})

  const stdout = new TextDecoder().decode(output.stdout)
  const stderr = new TextDecoder().decode(output.stderr)

  if (!output.success && stdout.trim().length === 0) {
    return { envelope: null, timedOut: output.signal === 'SIGKILL', rawStderr: stderr }
  }

  try {
    return { envelope: parseEnvelope(stdout), timedOut: false, rawStderr: stderr }
  } catch (error) {
    return {
      envelope: null,
      timedOut: false,
      rawStderr: `${error instanceof Error ? error.message : String(error)}\n${stderr}\n${stdout}`
    }
  }
}

/** Write a sandbox-local `skmtc` shim pinned to SANDBOX_CLI_VERSION
 * against the mirror registry. Returns the bin dir to prepend to
 * PATH, or null when no mirror URL is known. */
const writeSandboxCliShim = async (
  sandbox: string,
  mirrorJsrUrl: string | null
): Promise<string | null> => {
  if (!mirrorJsrUrl) return null

  const binDir = join(sandbox, 'bin')
  await Deno.mkdir(binDir, { recursive: true })
  const shimPath = join(binDir, 'skmtc')
  await Deno.writeTextFile(
    shimPath,
    [
      '#!/bin/sh',
      `exec env JSR_URL=${mirrorJsrUrl} deno run ${SKMTC_PERMS.join(' ')} --unstable-worker-options 'jsr:@skmtc/cli@${SANDBOX_CLI_VERSION}' "$@"`,
      ''
    ].join('\n')
  )
  await Deno.chmod(shimPath, 0o755)
  return binDir
}

const runTrial = async (args: {
  task: Task
  trial: number
  runLabel: string
  sha: string
  model: string
  judgeModel: string
  withDocs: boolean
  keepSandbox: boolean
  mirrorJsrUrl: string | null
}): Promise<TrialRow> => {
  const { task } = args
  const sandbox = await Deno.makeTempDir({ prefix: `skmtc-eval-${task.id}-` })
  const started = Date.now()

  // Trials run sequentially, so a set/restore of the process PATH is
  // safe — fixture setup, the agent, and run-command graders all
  // inherit the sandbox-local skmtc shim.
  const binDir = await writeSandboxCliShim(sandbox, args.mirrorJsrUrl)
  const originalPath = Deno.env.get('PATH') ?? ''
  if (binDir) Deno.env.set('PATH', `${binDir}:${originalPath}`)

  try {
    return await runTrialInner({ ...args, sandbox, started })
  } finally {
    if (binDir) Deno.env.set('PATH', originalPath)
  }
}

const runTrialInner = async (args: {
  task: Task
  trial: number
  runLabel: string
  sha: string
  model: string
  judgeModel: string
  withDocs: boolean
  keepSandbox: boolean
  sandbox: string
  started: number
}): Promise<TrialRow> => {
  const { task, sandbox, started } = args

  if (task.fixture) {
    const setupPath = join(evalsDir, 'fixtures', task.fixture, 'setup.ts')
    const setup = await new Deno.Command('deno', {
      args: ['run', '-A', setupPath, sandbox],
      cwd: sandbox,
      stdout: 'piped',
      stderr: 'piped'
    }).output()
    if (!setup.success) {
      throw new Error(
        `fixture setup failed for ${task.id}: ${new TextDecoder().decode(setup.stderr)}`
      )
    }
  }

  const useDocs = args.withDocs && task.docs.length > 0
  if (useDocs) {
    for (const entry of task.docs) {
      await copyDocEntry(entry, sandbox)
    }
  }

  const prompt = useDocs
    ? `${task.prompt}\n\nReference documentation is available in the docs/ directory of this workspace. Read the relevant files before starting.`
    : task.prompt

  const { envelope, timedOut, rawStderr } = await spawnAgent({
    prompt,
    sandbox,
    maxTurns: task.maxTurns,
    model: args.model
  })

  const finalMessage = envelope?.result ?? `(agent produced no result envelope) ${rawStderr}`

  const graders = envelope
    ? await runGraders({
        specs: task.graders,
        sandbox,
        finalMessage,
        judgeModel: args.judgeModel
      })
    : []

  const pass = envelope !== null && !envelope.isError && graders.every(result => result.pass)

  const keep = !pass || args.keepSandbox
  if (!keep) {
    await Deno.remove(sandbox, { recursive: true })
  }

  return {
    runLabel: args.runLabel,
    task: task.id,
    trial: args.trial,
    docsMode: useDocs ? 'with-docs' : 'no-docs',
    docsSha: args.sha,
    model: args.model,
    pass,
    graders,
    numTurns: envelope?.numTurns ?? null,
    outputTokens: envelope?.outputTokens ?? null,
    notionalUsd: envelope?.notionalUsd ?? null,
    durationMs: Date.now() - started,
    isError: envelope?.isError ?? true,
    timedOut,
    sandbox: keep ? sandbox : null,
    sessionId: envelope?.sessionId ?? null,
    finalMessage,
    timestamp: new Date().toISOString()
  }
}

const listTaskIds = async (): Promise<string[]> => {
  const ids: string[] = []
  for await (const entry of Deno.readDir(join(evalsDir, 'tasks'))) {
    if (entry.isFile && entry.name.endsWith('.md')) {
      ids.push(entry.name.replace(/\.md$/, ''))
    }
  }
  return ids.sort()
}

const main = async (): Promise<void> => {
  // Capture the mirror URL for the sandbox CLI shim, then strip
  // JSR_URL from the harness env so nothing outside the shim
  // accidentally resolves against it (the installed system skmtc
  // dies when JSR_URL points at the mirror — registry split; see
  // the plan's "Environment discoveries").
  const mirrorJsrUrl = Deno.env.get('JSR_URL') ?? null
  Deno.env.delete('JSR_URL')

  const flags = parseArgs(Deno.args, {
    string: ['task', 'trials', 'label', 'model', 'judge-model'],
    boolean: ['no-docs', 'keep-sandbox'],
    collect: ['task'],
    default: { trials: '1', model: 'sonnet', 'judge-model': 'haiku' }
  })

  const trials = Number.parseInt(flags.trials, 10)
  if (!Number.isFinite(trials) || trials < 1) {
    console.error(`invalid --trials: ${flags.trials}`)
    Deno.exit(2)
  }

  const requested = flags.task.flatMap(value => value.split(',')).filter(Boolean)
  const taskIds = requested.length > 0 ? requested : await listTaskIds()
  const runLabel = flags.label ?? `adhoc-${new Date().toISOString().slice(0, 10)}`
  const sha = await docsSha()

  const resultsDir = join(evalsDir, 'results')
  await Deno.mkdir(resultsDir, { recursive: true })
  const resultsPath = join(resultsDir, `${runLabel}.jsonl`)

  const rows: TrialRow[] = []

  for (const taskId of taskIds) {
    const task = await loadTask(join(evalsDir, 'tasks', `${taskId}.md`))

    for (let trial = 1; trial <= trials; trial++) {
      console.log(`▶ ${task.id} trial ${trial}/${trials} (${flags['no-docs'] ? 'no-docs' : 'with-docs'})`)

      const row = await runTrial({
        task,
        trial,
        runLabel,
        sha,
        model: flags.model,
        judgeModel: flags['judge-model'],
        withDocs: !flags['no-docs'],
        keepSandbox: flags['keep-sandbox'],
        mirrorJsrUrl
      })

      rows.push(row)
      await Deno.writeTextFile(resultsPath, `${JSON.stringify(row)}\n`, { append: true })

      const verdict = row.pass ? 'PASS' : 'FAIL'
      const failedGraders = row.graders.filter(result => !result.pass)
      const tokens =
        row.outputTokens !== null ? `${(row.outputTokens / 1000).toFixed(1)}k out-tokens` : '?'
      console.log(
        `  ${verdict} turns=${row.numTurns ?? '?'} ${tokens} ${Math.round(
          row.durationMs / 1000
        )}s${row.timedOut ? ' TIMED-OUT' : ''}`
      )
      for (const failed of failedGraders) {
        console.log(`    ✗ ${failed.kind}: ${failed.detail}`)
      }
      if (row.sandbox) console.log(`    sandbox: ${row.sandbox}`)
    }
  }

  console.log(`\n== summary (${runLabel}, docs @ ${sha}) ==`)
  for (const taskId of taskIds) {
    const taskRows = rows.filter(row => row.task === taskId)
    const passes = taskRows.filter(row => row.pass).length
    const avgTurns =
      taskRows.filter(row => row.numTurns !== null).length > 0
        ? (
            taskRows.reduce((sum, row) => sum + (row.numTurns ?? 0), 0) /
            taskRows.filter(row => row.numTurns !== null).length
          ).toFixed(1)
        : '?'
    const outputTokens = taskRows.reduce((sum, row) => sum + (row.outputTokens ?? 0), 0)
    console.log(
      `  ${taskId}: ${passes}/${taskRows.length} pass, avg turns ${avgTurns}, ${(
        outputTokens / 1000
      ).toFixed(1)}k out-tokens`
    )
  }
  console.log(`results: ${resultsPath}`)

  Deno.exit(rows.every(row => row.pass) ? 0 : 1)
}

await main()
