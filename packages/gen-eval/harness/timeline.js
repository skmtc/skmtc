#!/usr/bin/env node
/**
 * Turn-by-turn progress view over a Claude Code stream-json feed.
 *
 *   ... | node timeline.js --tee <timeline.md>   # live: stdin -> terminal + file
 *   node timeline.js <transcript.jsonl>          # post-hoc render to stdout
 */
import { createInterface } from 'node:readline'
import { createReadStream, createWriteStream } from 'node:fs'

const MILESTONE_FILES = ['base.ts', 'mod.ts', 'enrichments.ts']
const MILESTONE_CMDS = [
  ['skmtc bundle', 'first bundle attempt'],
  ['skmtc generate', 'first generate attempt'],
  ['gradle test', 'first test attempt']
]

process.stdout.on('error', error => {
  if (error.code === 'EPIPE') process.exit(0)
  throw error
})

const start = Date.now()
let turn = 0
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
  } else if (name === 'Grep' || name === 'Glob') {
    label = `${name}: ${String(input.pattern ?? input.query ?? '').slice(0, 60)}`
  } else {
    label = `${name}: ${JSON.stringify(input).slice(0, 70)}`
  }
  toolNames.set(item.id, label)
  emit(label)
}

const handleEvent = event => {
  if (event.type === 'system' && event.subtype === 'init') {
    emit(`session start — model ${event.model || '?'}`)
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
      if (item.type === 'thinking') emit(`thinking (${(item.thinking || '').length} chars)`)
      else if (item.type === 'text') {
        const text = String(item.text || '').replace(/\s+/g, ' ').trim()
        if (text) emit(`say: ${text.slice(0, 110)}`)
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
