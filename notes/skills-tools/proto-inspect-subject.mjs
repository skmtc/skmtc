#!/usr/bin/env node
// Proto-B1 (H3 gate, notes/skills-tools/PLAN.md): per-subject view over a
// `skmtc generate --debug` capture. Ground-truths what the capture can
// show — value tree, imports, definitions, rendered text — and, by
// omission, what it cannot (per-lookup cache hit/miss, event ordering:
// those belong to B3's trace).
//
// Usage: node proto-inspect-subject.mjs <capture.json> <generator-id> <subject>
//   subject matches any generatorKey segment (model refName, or op path/method)

import { readFileSync } from 'node:fs'

const [capturePath, generatorId, subject] = process.argv.slice(2)
if (!capturePath || !generatorId || !subject) {
  console.error('usage: proto-inspect-subject.mjs <capture.json> <generator-id> <subject>')
  process.exit(1)
}

const { artifacts, inspection } = JSON.parse(readFileSync(capturePath, 'utf8'))

const SKIP_KEYS = new Set(['settings', 'operation', 'context', 'stackTrail', 'skipped', '__class', 'generatorKey'])
const MAX_DEPTH = 6

const isNode = value => value !== null && typeof value === 'object'

const shortJson = value => {
  const text = JSON.stringify(value)
  return text.length > 80 ? `${text.slice(0, 77)}…` : text
}

const printTree = (node, indent, depth, ownerKey) => {
  if (!isNode(node)) return console.log(`${indent}${shortJson(node)}`)

  if (node.__class === 'Map') {
    for (const [key, child] of Object.entries(node)) {
      if (key === '__class') continue
      console.log(`${indent}${key}:`)
      printTree(child, indent + '  ', depth + 1, ownerKey)
    }
    return
  }

  if (Array.isArray(node)) {
    node.forEach(child => printTree(child, indent, depth, ownerKey))
    return
  }

  if (node.__class) {
    const foreign = node.generatorKey && node.generatorKey !== ownerKey ? `  [from ${node.generatorKey}]` : ''
    console.log(`${indent}${node.__class}${foreign}`)
    if (depth >= MAX_DEPTH) return console.log(`${indent}  …`)
    for (const [key, child] of Object.entries(node)) {
      if (SKIP_KEYS.has(key)) continue
      if (isNode(child)) {
        console.log(`${indent}  ${key}:`)
        printTree(child, indent + '    ', depth + 1, node.generatorKey ?? ownerKey)
      } else if (child !== null && child !== undefined) {
        console.log(`${indent}  ${key}: ${shortJson(child)}`)
      }
    }
    return
  }

  for (const [key, child] of Object.entries(node)) {
    console.log(`${indent}${key}:`)
    printTree(child, indent + '  ', depth + 1, ownerKey)
  }
}

let matches = 0

for (const [path, file] of Object.entries(inspection)) {
  const definitions = Object.entries(file.definitions ?? {}).filter(([key]) => key !== '__class')
  const hits = definitions.filter(([, definition]) => {
    const key = definition.generatorKey ?? ''
    return key.startsWith(`${generatorId}|`) && key.split('|').some(segment => segment.toLowerCase().includes(subject.toLowerCase()))
  })
  if (hits.length === 0) continue

  for (const [slot, definition] of hits) {
    matches++
    console.log(`\n━━ ${definition.identifier?.name} (${definition.identifier?.type}) @ ${path}`)
    console.log(`   slot: ${slot}   generatorKey: ${definition.generatorKey}`)
    console.log('\n   value tree:')
    printTree(definition.value, '     ', 0, definition.generatorKey)
  }

  const imports = Object.entries(file.imports ?? {}).filter(([key]) => key !== '__class')
  if (imports.length) {
    console.log('\n   file imports:')
    for (const [module, imp] of imports) {
      const names = (imp.specifiers ?? []).map(s => (s.typeOnly ? `type ${s.name}` : s.name)).join(', ')
      console.log(`     ${module}: [${names}]`)
    }
  }

  const rendered = artifacts[path]
  if (rendered) {
    console.log(`\n   rendered (${path}, first 20 lines):`)
    rendered.split('\n').slice(0, 20).forEach(line => console.log(`     ${line}`))
  }
}

console.log(matches ? `\n${matches} definition(s) matched.` : `no definitions matched ${generatorId} + "${subject}"`)
