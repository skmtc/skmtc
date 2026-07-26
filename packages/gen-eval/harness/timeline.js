#!/usr/bin/env node
/**
 * Turn-by-turn progress view over a Claude Code stream-json feed.
 *
 *   ... | node timeline.js --tee <timeline.md>   # live: stdin -> terminal + file
 *   node timeline.js <transcript.jsonl>          # post-hoc render to stdout
 */
import { createInterface } from 'node:readline'
import { createReadStream, createWriteStream } from 'node:fs'
import { DEEP_THINK_SECONDS, DEEP_THINK_TOKENS } from './constants.js'

const MILESTONE_FILES = ['base.ts', 'mod.ts', 'enrichments.ts']
const MILESTONE_CMDS = [
  ['skmtc bundle', 'first bundle attempt'],
  ['skmtc generate', 'first generate attempt'],
  ['gradle test', 'first test attempt']
]
// A think block is "deep" when it stalls the run or reasons at plan
// scale: 60 s is an order of magnitude above the typical few-second
// block and long enough to read as a stall; 5000 tokens is past
// step-level deliberation. Either alone fires. Unlike the other
// milestones this one fires per block, not once — a run can stall
// repeatedly and each stall is a separate thing to bracket.
// Thresholds: constants.js (shared with thinking.js and the viewer).

process.stdout.on('error', error => {
  if (error.code === 'EPIPE') process.exit(0)
  throw error
})

const start = Date.now()
let turn = 0
let pendingThinkingTokens = null
let lastEventTime = null
const toolNames = new Map()
const seenMilestones = new Set()

const args = process.argv.slice(2)
const teeMode = args[0] === '--tee'
const outFile = teeMode && args[1] ? createWriteStream(args[1]) : null
if (outFile) outFile.write('# Run timeline\n\n```\n')

const elapsed = () => {
  const seconds = Math.floor((Date.now() - start) / 1000)
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

const emit = text => {
  const line = `[${elapsed()} t${String(turn).padStart(3, '0')}] ${text}`
  process.stdout.write(line + '\n')
  if (outFile) outFile.write(line + '\n')
}

const milestone = (key, text) => {
  if (seenMilestones.has(key)) return
  seenMilestones.add(key)
  emit(`*** MILESTONE: ${text}`)
}

const FRICTION_TITLE = /^##\s*\d*\.?\s*(.+)$/gm
const feedbackMark = (path, content) => {
  if (path.endsWith('FRICTION.md')) {
    const titles = [...String(content || '').matchAll(FRICTION_TITLE)]
    const last = titles.length ? titles[titles.length - 1][1] : null
    emit(`*** FRICTION${last ? `: ${last.slice(0, 80)}` : ' entry logged'}`)
  } else if (path.endsWith('RETRO.md')) {
    emit('*** RETRO written')
  } else if (path.endsWith('PLAN.md')) {
    // The plan is the externalized form of the reasoning the API
    // redacts — every write is a mark, since the task asks for it to be
    // amended in place rather than rewritten.
    emit('*** PLAN written/amended')
  }
}

const resultText = raw =>
  Array.isArray(raw) ? raw.map(part => (part && part.text) || '').join(' ') : String(raw ?? '')

const handleToolUse = item => {
  const name = item.name || '?'
  const input = item.input || {}
  let label = name
  if (name === 'Skill') {
    label = `Skill: ${input.skill || '?'}`
    if (String(input.skill || '').includes('skmtc')) {
      milestone(`skill:${input.skill}`, `loaded ${input.skill} skill`)
    }
  } else if (['Write', 'Edit', 'MultiEdit', 'Read'].includes(name)) {
    const path = input.file_path || '?'
    label = `${name}: ${path.split('/').slice(-3).join('/')}`
    if (name === 'Write' || name === 'Edit') {
      for (const marker of MILESTONE_FILES) {
        if (path.endsWith(`src/${marker}`) && path.includes('gen-')) {
          milestone(`write:${marker}`, `generator src/${marker} written`)
        }
      }
      feedbackMark(path, input.content ?? input.new_string)
    }
  } else if (name === 'Bash') {
    const full = String(input.command || '')
    const command = full.replace(/\s+/g, ' ').slice(0, 90)
    label = `Bash: ${command}`
    for (const [needle, text] of MILESTONE_CMDS) {
      if (command.includes(needle)) milestone(`cmd:${needle}`, text)
    }
    // heredoc writes count as generator-file milestones too
    for (const marker of MILESTONE_FILES) {
      if (full.includes(`src/${marker}`) && full.includes('gen-') && full.includes('<<')) {
        milestone(`write:${marker}`, `generator src/${marker} written`)
      }
    }
    if (full.includes('FRICTION.md') && (full.includes('<<') || full.includes('>'))) {
      feedbackMark('FRICTION.md', full)
    }
    if (full.includes('RETRO.md') && (full.includes('<<') || full.includes('>'))) {
      feedbackMark('RETRO.md', full)
    }
  } else if (name === 'Grep' || name === 'Glob') {
    label = `${name}: ${String(input.pattern ?? input.query ?? '').slice(0, 60)}`
  } else {
    label = `${name}: ${JSON.stringify(input).slice(0, 70)}`
  }
  toolNames.set(item.id, label)
  emit(label)
}

const handleEvent = event => {
  // Wall gap = this message's timestamp minus the previous timestamped
  // event (assistant OR user — tool results carry timestamps too). The
  // thinking text is redacted, so the gap and the streamed token
  // estimate are all the block leaves behind.
  const eventTime = event.timestamp ? Date.parse(event.timestamp) : null
  const gapSeconds = eventTime != null && lastEventTime != null
    ? (eventTime - lastEventTime) / 1000
    : null
  if (eventTime != null) lastEventTime = eventTime
  if (event.type === 'system' && event.subtype === 'init') {
    emit(`session start — model ${event.model || '?'}`)
    return
  }
  if (event.type === 'system' && event.subtype === 'thinking_tokens') {
    pendingThinkingTokens = event.estimated_tokens ?? pendingThinkingTokens
    return
  }
  if (event.type === 'assistant') {
    const content = (event.message || {}).content || []
    let bumped = false
    for (const item of content) {
      if (!item) continue
      if (!bumped && ['text', 'tool_use', 'thinking'].includes(item.type)) {
        turn += 1
        bumped = true
      }
      if (item.type === 'thinking') {
        const chars = (item.thinking || '').length
        const tokens = pendingThinkingTokens
        const gap = gapSeconds != null ? `, ${gapSeconds.toFixed(1)}s` : ''
        emit(chars > 0
          ? `thinking (${chars} chars${gap})`
          : `thinking (redacted${tokens ? `, ~${tokens} tok` : ''}${gap})`)
        if ((gapSeconds != null && gapSeconds > DEEP_THINK_SECONDS) || (tokens ?? 0) > DEEP_THINK_TOKENS) {
          milestone(
            `deep-think:${turn}`,
            `deep think — ${gapSeconds != null ? `${gapSeconds.toFixed(0)}s` : 'unknown gap'}` +
              `${tokens ? ` / ~${tokens} tokens` : ''} (reasoning redacted — bracket it: harness/thinking.js)`
          )
        }
        pendingThinkingTokens = null
      }
      else if (item.type === 'text') {
        const text = String(item.text || '').replace(/\s+/g, ' ').trim()
        if (!text) continue
        if (text.startsWith('WHY:')) emit(`>>> ${text.slice(0, 140)}`)
        else emit(`say: ${text.slice(0, 110)}`)
      } else if (item.type === 'tool_use') handleToolUse(item)
    }
  } else if (event.type === 'user') {
    for (const item of ((event.message || {}).content || [])) {
      if (!item || item.type !== 'tool_result') continue
      const text = resultText(item.content)
      if (item.is_error) {
        const label = toolNames.get(item.tool_use_id) || '?'
        emit(`  !! error <- ${label}: ${text.replace(/\s+/g, ' ').slice(0, 90)}`)
      } else {
        if (/"errors":\s*\[\]/.test(text) && /"type":\s*"generated"/.test(text)) {
          milestone('generate-ok', 'clean generate (no errors)')
        }
        if (text.includes('BUILD SUCCESSFUL')) milestone('gradle-ok', 'gradle BUILD SUCCESSFUL')
      }
    }
  } else if (event.type === 'result') {
    const cost = event.total_cost_usd != null ? ` cost=$${event.total_cost_usd.toFixed(2)}` : ''
    emit(`done — turns=${event.num_turns}${cost} error=${event.is_error}`)
  }
}

const source = teeMode ? process.stdin : createReadStream(args[0] ?? 0)
const lines = createInterface({ input: source, crlfDelay: Infinity })
lines.on('line', line => {
  if (!line.trim()) return
  let event
  try {
    event = JSON.parse(line)
  } catch {
    return
  }
  try {
    handleEvent(event)
  } catch (error) {
    process.stderr.write(`[timeline error: ${error}]\n`)
  }
})
lines.on('close', () => {
  if (outFile) outFile.end('```\n')
})
