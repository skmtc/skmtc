import { parseArgs } from "jsr:@std/cli@^1/parse-args"
import { dirname, fromFileUrl, join, resolve } from "jsr:@std/path@^1"
import { ensureDir } from "jsr:@std/fs@^1"

const RUNNER_MODEL = "claude-sonnet-4-6"
const JUDGE_MODEL = "claude-sonnet-4-6"
const MAX_CONCURRENCY = 4
const RUNNER_MAX_TOKENS = 4096
const JUDGE_MAX_TOKENS = 512

type Criterion = {
  id: string
  check: string
}

type ExpectedOutcome = "refuse" | "edit" | "defer"

type Task = {
  id: string
  category: string
  prompt: string
  criteria: Criterion[]
  scoring: "all_or_nothing"
  expected_outcome: ExpectedOutcome
}

type Judgment = {
  criterion_id: string
  pass: boolean
  evidence: string
}

type TaskResult = {
  task_id: string
  category: string
  runner_output: string
  judgments: Judgment[]
  passed: boolean
}

type BaselineRecord = {
  set: SetName
  generated_at: string
  total: number
  passed: number
  task_results: Array<{ task_id: string; passed: boolean }>
}

type SetName = "dev" | "holdout"

function isCriterion(v: unknown): v is Criterion {
  if (typeof v !== "object" || v === null) return false
  if (!("id" in v) || typeof v.id !== "string") return false
  if (!("check" in v) || typeof v.check !== "string") return false
  return true
}

function isExpectedOutcome(v: unknown): v is ExpectedOutcome {
  return v === "refuse" || v === "edit" || v === "defer"
}

function isTask(v: unknown): v is Task {
  if (typeof v !== "object" || v === null) return false
  if (!("id" in v) || typeof v.id !== "string") return false
  if (!("category" in v) || typeof v.category !== "string") return false
  if (!("prompt" in v) || typeof v.prompt !== "string") return false
  if (!("criteria" in v) || !Array.isArray(v.criteria)) return false
  if (!v.criteria.every(isCriterion)) return false
  if (!("scoring" in v) || v.scoring !== "all_or_nothing") return false
  if (!("expected_outcome" in v) || !isExpectedOutcome(v.expected_outcome)) return false
  return true
}

function isBaselineRecord(v: unknown): v is BaselineRecord {
  if (typeof v !== "object" || v === null) return false
  if (!("set" in v) || (v.set !== "dev" && v.set !== "holdout")) return false
  if (!("task_results" in v) || !Array.isArray(v.task_results)) return false
  for (const r of v.task_results) {
    if (typeof r !== "object" || r === null) return false
    if (!("task_id" in r) || typeof r.task_id !== "string") return false
    if (!("passed" in r) || typeof r.passed !== "boolean") return false
  }
  return true
}

type CallOptions = {
  model: string
  systemText: string
  userText: string
  maxTokens: number
}

async function callMessages(opts: CallOptions): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY env var not set")

  const body = {
    model: opts.model,
    max_tokens: opts.maxTokens,
    system: [
      { type: "text", text: opts.systemText, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: opts.userText }],
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`API ${res.status}: ${errText}`)
  }

  const json: unknown = await res.json()
  if (typeof json !== "object" || json === null) {
    throw new Error("Unexpected response shape (not an object)")
  }
  if (!("content" in json) || !Array.isArray(json.content)) {
    throw new Error("Response missing content array")
  }

  let text = ""
  for (const block of json.content) {
    if (typeof block !== "object" || block === null) continue
    if (!("type" in block) || block.type !== "text") continue
    if (!("text" in block) || typeof block.text !== "string") continue
    text += block.text
  }
  return text
}

async function callMessagesWithRetry(opts: CallOptions, retries = 3): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await callMessages(opts)
    } catch (err) {
      lastError = err
      const msg = err instanceof Error ? err.message : String(err)
      const retriable = msg.includes("429") || msg.includes("529") || msg.includes("503")
      if (!retriable) throw err
      const delay = 1000 * 2 ** attempt
      console.error(`Retryable error (attempt ${attempt + 1}/${retries}): ${msg}; retrying in ${delay}ms`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  if (lastError instanceof Error) throw lastError
  throw new Error(String(lastError))
}

function buildJudgeSystem(invariantsText: string): string {
  return `You are evaluating whether a candidate response satisfies a single binary criterion.

Treat the SKMTC invariants below as ground truth. A candidate response that violates any invariant is incorrect, no matter how reasonable it looks.

Return ONLY a JSON object on a single line:
{"pass": true|false, "evidence": "<one short sentence or quoted span from the response>"}

When quoting text inside the evidence string, use single quotes ('like this') — never double quotes. Double quotes inside the JSON string will break parsing.

Do not infer beyond what is visible in the candidate response. Do not explain. Do not add prose. JSON only.

<invariants>
${invariantsText}
</invariants>`
}

function buildJudgeUserPrompt(task: Task, runnerOutput: string, criterion: Criterion): string {
  return `<task>
${task.prompt}
</task>

<expected-outcome>${task.expected_outcome}</expected-outcome>

<candidate-response>
${runnerOutput}
</candidate-response>

<criterion id="${criterion.id}">
${criterion.check}
</criterion>

Return only the JSON verdict.`
}

function parseJudgeVerdict(text: string): { pass: boolean; evidence: string } {
  let stripped = text.trim()
  if (stripped.startsWith("```")) {
    stripped = stripped.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
  }

  const tryParse = (raw: string): { pass: boolean; evidence: string } | null => {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
    if (typeof parsed !== "object" || parsed === null) return null
    if (!("pass" in parsed) || typeof parsed.pass !== "boolean") return null
    const evidence = "evidence" in parsed && typeof parsed.evidence === "string"
      ? parsed.evidence
      : ""
    return { pass: parsed.pass, evidence }
  }

  const direct = tryParse(stripped)
  if (direct) return direct

  const objectMatch = stripped.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    const fromMatch = tryParse(objectMatch[0])
    if (fromMatch) return fromMatch
  }

  const passMatch = stripped.match(/"pass"\s*:\s*(true|false)/)
  if (passMatch) {
    const pass = passMatch[1] === "true"
    console.error(
      `[parseJudgeVerdict] Recovered 'pass=${pass}' from malformed JSON (likely unescaped quotes in evidence):\n${text.slice(0, 200).replace(/\s+/g, " ")}`,
    )
    return {
      pass,
      evidence: `[partial parse — judge JSON broken by inner quotes] ${stripped.slice(0, 200).replace(/\s+/g, " ")}`,
    }
  }

  console.error(
    `[parseJudgeVerdict] Failed to parse judge output; treating as FAIL:\n${text.slice(0, 300)}`,
  )
  return {
    pass: false,
    evidence: `[unparseable judge output] ${text.slice(0, 200).replace(/\s+/g, " ")}`,
  }
}

async function runTask(
  task: Task,
  skillText: string,
  invariantsText: string,
): Promise<TaskResult> {
  const runnerOutput = await callMessagesWithRetry({
    model: RUNNER_MODEL,
    systemText: skillText,
    userText: task.prompt,
    maxTokens: RUNNER_MAX_TOKENS,
  })

  const judgeSystem = buildJudgeSystem(invariantsText)
  const judgments: Judgment[] = []
  for (const criterion of task.criteria) {
    const verdictText = await callMessagesWithRetry({
      model: JUDGE_MODEL,
      systemText: judgeSystem,
      userText: buildJudgeUserPrompt(task, runnerOutput, criterion),
      maxTokens: JUDGE_MAX_TOKENS,
    })
    const verdict = parseJudgeVerdict(verdictText)
    judgments.push({ criterion_id: criterion.id, pass: verdict.pass, evidence: verdict.evidence })
  }

  return {
    task_id: task.id,
    category: task.category,
    runner_output: runnerOutput,
    judgments,
    passed: judgments.every((j) => j.pass),
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIdx = 0
  const worker = async (): Promise<void> => {
    while (true) {
      const idx = nextIdx++
      if (idx >= items.length) return
      results[idx] = await fn(items[idx])
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )
  return results
}

async function loadTasks(dir: string, filterId: string | null): Promise<Task[]> {
  const tasks: Task[] = []
  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isFile || !entry.name.endsWith(".json")) continue
    const path = join(dir, entry.name)
    const text = await Deno.readTextFile(path)
    const parsed: unknown = JSON.parse(text)
    if (!isTask(parsed)) {
      throw new Error(`Invalid task file: ${path}`)
    }
    if (filterId !== null && parsed.id !== filterId) continue
    tasks.push(parsed)
  }
  tasks.sort((a, b) => a.id.localeCompare(b.id))
  return tasks
}

async function writeTrace(
  evalDir: string,
  setName: SetName,
  results: TaskResult[],
): Promise<void> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const runDir = join(evalDir, "runs", `${setName}-${ts}`)
  await ensureDir(runDir)
  await Deno.writeTextFile(
    join(runDir, "results.json"),
    JSON.stringify(results, null, 2),
  )
}

async function writeBaseline(
  evalDir: string,
  setName: SetName,
  results: TaskResult[],
): Promise<string> {
  const record: BaselineRecord = {
    set: setName,
    generated_at: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    task_results: results.map((r) => ({ task_id: r.task_id, passed: r.passed })),
  }
  const path = join(evalDir, `baseline-${setName}.json`)
  await Deno.writeTextFile(path, JSON.stringify(record, null, 2) + "\n")
  return path
}

async function checkAgainstBaseline(
  baselinePath: string,
  results: TaskResult[],
): Promise<boolean> {
  const baselineText = await Deno.readTextFile(baselinePath)
  const baseline: unknown = JSON.parse(baselineText)
  if (!isBaselineRecord(baseline)) {
    throw new Error(`Invalid baseline file: ${baselinePath}`)
  }
  const currentPassing = new Set(
    results.filter((r) => r.passed).map((r) => r.task_id),
  )
  const regressions: string[] = []
  for (const r of baseline.task_results) {
    if (r.passed && !currentPassing.has(r.task_id)) {
      regressions.push(r.task_id)
    }
  }
  if (regressions.length > 0) {
    console.error(`Regressions vs baseline: ${regressions.join(", ")}`)
    return false
  }
  return true
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    string: ["set", "task", "baseline-from"],
    boolean: ["verbose", "write-baseline"],
    default: { set: "dev" },
  })

  const setRaw = args.set
  if (setRaw !== "dev" && setRaw !== "holdout") {
    console.error(`--set must be 'dev' or 'holdout', got: ${setRaw}`)
    Deno.exit(2)
  }
  const setName: SetName = setRaw

  const evalDir = dirname(fromFileUrl(import.meta.url))
  const skillPath = resolve(evalDir, "..", "SKILL.md")
  const invariantsPath = join(evalDir, "invariants.md")
  const tasksDir = setName === "dev" ? join(evalDir, "tasks") : join(evalDir, "holdout")

  const [skillText, invariantsText] = await Promise.all([
    Deno.readTextFile(skillPath),
    Deno.readTextFile(invariantsPath),
  ])

  const filterId = typeof args.task === "string" ? args.task : null
  const tasks = await loadTasks(tasksDir, filterId)
  if (tasks.length === 0) {
    console.error(`No tasks found in ${tasksDir}${filterId ? ` matching --task=${filterId}` : ""}`)
    Deno.exit(2)
  }

  console.error(`Running ${tasks.length} task(s) from ${setName} set (${RUNNER_MODEL} → ${JUDGE_MODEL})...`)
  const results = await runWithConcurrency(tasks, MAX_CONCURRENCY, (t) =>
    runTask(t, skillText, invariantsText))

  await writeTrace(evalDir, setName, results)

  const passCount = results.filter((r) => r.passed).length

  if (args.verbose) {
    for (const r of results) {
      console.error(`${r.passed ? "PASS" : "FAIL"}  ${r.task_id}  (${r.category})`)
      for (const j of r.judgments) {
        console.error(`  ${j.pass ? "✓" : "✗"} ${j.criterion_id}: ${j.evidence}`)
      }
    }
  }
  console.error(`\nTotal: ${passCount}/${tasks.length}`)

  if (args["write-baseline"]) {
    const path = await writeBaseline(evalDir, setName, results)
    console.error(`Wrote baseline to ${path}`)
  }

  const baselineFrom = args["baseline-from"]
  if (typeof baselineFrom === "string") {
    const ok = await checkAgainstBaseline(resolve(evalDir, baselineFrom), results)
    if (!ok) {
      console.error("Guard FAILED — regression detected")
      Deno.exit(1)
    }
    console.error("Guard OK — no regression")
  }

  console.log(passCount)
}

if (import.meta.main) {
  await main()
}
