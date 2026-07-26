#!/usr/bin/env node
/**
 * Think-block analysis over a run's stream-json feed.
 *
 *   node thinking.js <run-dir>             # bracketed table, largest first
 *   node thinking.js <transcript.jsonl>    # same, from a bare transcript
 *   node thinking.js --json <run-dir>      # metrics object (meta.json)
 *   node thinking.js --summary <run-dir>   # one line (report.md)
 *
 * The reasoning text is redacted by the API, but the stream still
 * carries `system/thinking_tokens` events, per-message timestamps, and
 * per-message usage — so every block is measurable even though it is
 * unreadable. The only diagnosis left is bracketing: what the model had
 * just seen (the tool calls before) and what it decided (the assistant
 * text and first file write after). Each record prints both.
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DEEP_THINK_SECONDS, DEEP_THINK_TOKENS } from './constants.js'

// Deep-think thresholds and their rationale: constants.js.

const args = process.argv.slice(2)
const mode = (args.find(arg => arg.startsWith('--')) ?? '--table').slice(2)
const target = resolve(args.find(arg => !arg.startsWith('--')) ?? '.')

const transcriptPath =
  existsSync(target) && statSync(target).isDirectory() ? join(target, 'transcript.jsonl') : target

if (!existsSync(transcriptPath)) {
  console.error(`no transcript at ${transcriptPath}`)
  process.exit(1)
}

const events = readFileSync(transcriptPath, 'utf8')
  .split('\n')
  .map(line => {
    try {
      return JSON.parse(line)
    } catch {
      return null
    }
  })
  .filter(Boolean)

const eventTime = event => (event.timestamp ? Date.parse(event.timestamp) : null)

const commas = value => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const compact = value => (value >= 1000 ? `${Math.round(value / 1000)}k` : String(value))
const clock = seconds => {
  const whole = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
}

const toolLabel = item => {
  const name = item.name || '?'
  const input = item.input || {}
  if (name === 'Skill') return `Skill: ${input.skill || '?'}`
  if (['Write', 'Edit', 'MultiEdit', 'Read', 'NotebookEdit'].includes(name)) {
    return `${name}: ${String(input.file_path || '?').split('/').slice(-3).join('/')}`
  }
  if (name === 'Bash') return `Bash: ${String(input.command || '').replace(/\s+/g, ' ').slice(0, 70)}`
  if (name === 'Grep' || name === 'Glob') {
    return `${name}: ${String(input.pattern ?? input.query ?? '').slice(0, 60)}`
  }
  return `${name}: ${JSON.stringify(input).slice(0, 60)}`
}

const contentOf = event => (event.message || {}).content || []
const isThinking = event => contentOf(event).some(item => item && item.type === 'thinking')

// ---- walk: attribute streamed token estimates + wall gaps to messages
// `estimated_tokens` is cumulative per block (the deltas restart at each
// new block), so the last value seen before an assistant message is that
// block's size — never a sum across blocks.
const walk = () => {
  const blocks = []
  let pendingTokens = 0
  let previousTime = null
  let firstTime = null
  let lastTime = null
  let assistantIndex = 0

  events.forEach((event, index) => {
    if (event.type === 'system' && event.subtype === 'thinking_tokens') {
      pendingTokens = event.estimated_tokens ?? pendingTokens
      return
    }
    const time = eventTime(event)
    if (time != null && firstTime == null) firstTime = time
    if (time != null) lastTime = time
    if (event.type === 'assistant') {
      assistantIndex += 1
      if (pendingTokens > 0) {
        const usage = (event.message || {}).usage || {}
        blocks.push({
          index,
          assistantIndex,
          estimatedTokens: pendingTokens,
          seconds: time != null && previousTime != null ? (time - previousTime) / 1000 : null,
          elapsedSeconds: time != null && firstTime != null ? (time - firstTime) / 1000 : null,
          contextTokens:
            (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
          redacted: contentOf(event).every(item => !item || !item.thinking)
        })
      }
      pendingTokens = 0
    }
    if (time != null) previousTime = time
  })

  return { blocks, firstTime, lastTime }
}

// ---- bracketing: the last tool calls before a block, and the first
// assistant text / file write after it (bounded by the next block, so a
// decision is never attributed to reasoning it did not follow).
const toolsBefore = (blockIndex, count) => {
  const collected = []
  for (let index = blockIndex - 1; index >= 0 && collected.length < count; index -= 1) {
    const event = events[index]
    if (!event || event.type !== 'assistant') continue
    for (const item of contentOf(event)) {
      if (item && item.type === 'tool_use' && collected.length < count) collected.unshift(toolLabel(item))
    }
  }
  return collected
}

const decisionAfter = blockIndex => {
  const decision = { text: null, write: null }
  for (let index = blockIndex + 1; index < events.length; index += 1) {
    const event = events[index]
    if (!event || event.type !== 'assistant') continue
    if (isThinking(event)) break
    for (const item of contentOf(event)) {
      if (!item) continue
      if (item.type === 'text' && !decision.text) {
        const text = String(item.text || '').replace(/\s+/g, ' ').trim()
        if (text) decision.text = text
      }
      if (item.type === 'tool_use' && !decision.write && ['Write', 'Edit', 'MultiEdit'].includes(item.name)) {
        const input = item.input || {}
        const size = (input.content ?? input.new_string ?? '').length
        decision.write = `${toolLabel(item)}${size ? ` (${commas(size)} chars)` : ''}`
      }
    }
    if (decision.text && decision.write) break
  }
  return decision
}

const isDeep = block =>
  (block.seconds != null && block.seconds > DEEP_THINK_SECONDS) ||
  block.estimatedTokens > DEEP_THINK_TOKENS

// ---- metrics ---------------------------------------------------------
const { blocks, firstTime, lastTime } = walk()

const resultEvent = events.filter(event => event.type === 'result').pop() ?? null
const outputTokens = resultEvent?.usage?.output_tokens ?? null
const runSeconds =
  resultEvent?.duration_ms != null
    ? resultEvent.duration_ms / 1000
    : firstTime != null && lastTime != null
      ? (lastTime - firstTime) / 1000
      : null

const totalTokens = blocks.reduce((sum, block) => sum + block.estimatedTokens, 0)
const ranked = [...blocks].sort((left, right) => right.estimatedTokens - left.estimatedTokens)
const maxBlock = ranked[0] ?? null
const share = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 1000 : null)
const percent = value => (value == null ? 'n/a' : `${Math.round(value * 100)}%`)

const metrics = {
  blockCount: blocks.length,
  thinkTotalTokens: totalTokens,
  outputTokens,
  shareOfOutput: share(totalTokens, outputTokens),
  runSeconds: runSeconds != null ? Math.round(runSeconds * 10) / 10 : null,
  deepBlockCount: blocks.filter(isDeep).length,
  maxThinkBlock: maxBlock
    ? {
        tokens: maxBlock.estimatedTokens,
        seconds: maxBlock.seconds != null ? Math.round(maxBlock.seconds * 10) / 10 : null,
        elapsedSeconds:
          maxBlock.elapsedSeconds != null ? Math.round(maxBlock.elapsedSeconds * 10) / 10 : null,
        contextTokens: maxBlock.contextTokens,
        assistantIndex: maxBlock.assistantIndex,
        shareOfRun: maxBlock.seconds != null ? share(maxBlock.seconds, runSeconds) : null,
        after: decisionAfter(maxBlock.index).write
      }
    : null
}

// ---- output ----------------------------------------------------------
if (mode === 'json') {
  console.log(JSON.stringify(metrics, null, 2))
  process.exit(0)
}

const summaryLine = () => {
  if (!maxBlock) return 'no think blocks recorded in the stream'
  const largest = metrics.maxThinkBlock
  return (
    `${commas(totalTokens)} estimated token(s) across ${metrics.blockCount} block(s)` +
    (metrics.shareOfOutput != null ? ` (${percent(metrics.shareOfOutput)} of model output)` : '') +
    `; largest ${commas(largest.tokens)} tokens` +
    (largest.seconds != null ? ` / ${largest.seconds}s` : '') +
    (largest.shareOfRun != null ? ` (${percent(largest.shareOfRun)} of run wall clock)` : '') +
    (largest.elapsedSeconds != null ? ` at ${clock(largest.elapsedSeconds)} into the run` : '') +
    (largest.after ? `, decided: ${largest.after}` : '') +
    (metrics.deepBlockCount ? ` — ${metrics.deepBlockCount} deep block(s)` : '')
  )
}

if (mode === 'summary') {
  console.log(summaryLine())
  process.exit(0)
}

// Largest first: the table is long-tailed (one block routinely carries
// most of the reasoning) and the block you must read is then the first
// one printed. Run order is not lost — every record carries its elapsed
// time into the run.
console.log(`# think blocks — ${transcriptPath}`)
console.log('')
if (!blocks.length) {
  console.log('no system/thinking_tokens events in this transcript')
  process.exit(0)
}

ranked.forEach((block, rank) => {
  const seconds = block.seconds != null ? `${block.seconds.toFixed(1)}s` : '?'
  const head =
    `${`#${rank + 1}`.padEnd(4)}at ${clock(block.elapsedSeconds ?? 0)}` +
    `  gap ${seconds.padStart(7)}` +
    `  ~${commas(block.estimatedTokens).padStart(7)} tokens` +
    `  context ${compact(block.contextTokens).padStart(5)}` +
    `  msg ${block.assistantIndex}` +
    (isDeep(block) ? '  *** DEEP THINK' : '') +
    (block.redacted ? '' : '  (plaintext)')
  console.log(head)
  const before = toolsBefore(block.index, 3)
  before.forEach((label, position) => {
    console.log(`     ${position === 0 ? 'before' : '      '}  ${label}`)
  })
  if (!before.length) console.log('     before  (nothing — start of run)')
  const decision = decisionAfter(block.index)
  console.log(`     after   ${decision.text ? decision.text.slice(0, 110) : '(no assistant text)'}`)
  console.log(
    `             ${decision.write ?? '(no Write/Edit before the next think block)'}`
  )
  console.log('')
})

console.log(`total: ${summaryLine()}`)
if (outputTokens == null) console.log('(no result event — output-token share unavailable)')
