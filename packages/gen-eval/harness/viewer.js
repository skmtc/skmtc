#!/usr/bin/env node
/**
 * Bake a self-contained in-browser run viewer.
 *
 *   node viewer.js <run-dir>             # embed transcript.jsonl (+meta.json)
 *   node viewer.js --template out.html   # un-baked page: live-polls over the
 *                                        # dashboard, or accepts drag-drop
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEEP_THINK_SECONDS, DEEP_THINK_TOKENS, MILESTONE_CMDS, MILESTONE_FILES } from './constants.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const TEMPLATE = readFileSync(join(HERE, 'viewer.template.html'), 'utf8')

const escapeForScript = payload => payload.replaceAll('</', '<\\/')

const args = process.argv.slice(2)

if (args[0] === '--template') {
  const out = args[1] ?? 'viewer.html'
  writeFileSync(out, TEMPLATE.replace('__DATA__', 'null').replace('__META__', 'null').replace('__DEEP_THINK_SECONDS__', String(DEEP_THINK_SECONDS)).replace('__DEEP_THINK_TOKENS__', String(DEEP_THINK_TOKENS)).replace('__MILESTONE_FILES__', JSON.stringify(MILESTONE_FILES)).replace('__MILESTONE_CMDS__', JSON.stringify(MILESTONE_CMDS)))
  console.log(`wrote ${out} (live/drag-drop mode)`)
  process.exit(0)
}

const runDir = resolve(args[0] ?? '.')
const transcriptPath = join(runDir, 'transcript.jsonl')
if (!existsSync(transcriptPath)) {
  console.error(`no transcript.jsonl in ${runDir}`)
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

let meta = null
const metaPath = join(runDir, 'meta.json')
if (existsSync(metaPath)) {
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf8'))
  } catch {
    meta = null
  }
}

const html = TEMPLATE.replace('__DATA__', escapeForScript(JSON.stringify(events)))
  .replace('__META__', escapeForScript(JSON.stringify(meta)))
  .replace('__DEEP_THINK_SECONDS__', String(DEEP_THINK_SECONDS)).replace('__DEEP_THINK_TOKENS__', String(DEEP_THINK_TOKENS)).replace('__MILESTONE_FILES__', JSON.stringify(MILESTONE_FILES)).replace('__MILESTONE_CMDS__', JSON.stringify(MILESTONE_CMDS))
const out = join(runDir, 'viewer.html')
writeFileSync(out, html)
console.log(`wrote ${out} (${events.length} events)`)
console.log(`view:  file://${out}`)
