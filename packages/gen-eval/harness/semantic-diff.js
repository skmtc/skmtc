#!/usr/bin/env node
// Semantic diff between two Kotlin files at top-level-declaration
// granularity. Usage (from gates.sh):
//   REF=<file> GEN=<file> NORM_OUT=<residue-file> node semantic-diff.js
// Prints the residue count to stdout.
//
// Canonicalization: comments stripped, each chunk (annotations +
// declaration + its body) collapsed to one line with uniform whitespace
// and no trailing commas. Chunks compare as an order-insensitive
// multiset, so hand-authored declaration order, line-wrapping, KDoc
// prose, and trailing commas all vanish; what remains differing is a
// real annotation/type/shape difference.
import { readFileSync, writeFileSync } from 'node:fs'

const CHUNK_START =
  /^(@|package\b|import\b|data\b|class\b|enum\b|sealed\b|interface\b|typealias\b|fun\b|val\b|var\b|object\b|private\b|public\b|internal\b)/

const toChunks = source => {
  const lines = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, '').trimEnd())
    .filter(line => line.trim() !== '')
  const chunks = []
  let current = []
  // Indented lines are continuations of a multi-line annotation
  // (`@JsonSubTypes(` + indented `JsonSubTypes.Type(...)` entries +
  // col-0 `)`), so they keep the chunk annotation-only.
  const currentIsAnnotationsOnly = () =>
    current.length > 0 &&
    current.every(line => line.startsWith('@') || line.startsWith(')') || /^\s/.test(line))
  for (const line of lines) {
    const startsChunk = !/^\s/.test(line) && CHUNK_START.test(line)
    // A col-0 keyword line directly after a col-0 annotation block is the
    // declaration those annotations belong to, not a new chunk.
    const annotationContinuation = startsChunk && !line.startsWith('@') && currentIsAnnotationsOnly()
    if (startsChunk && !annotationContinuation && current.length) {
      chunks.push(current)
      current = []
    }
    current.push(line)
  }
  if (current.length) chunks.push(current)
  return chunks.map(chunk =>
    chunk
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/,\s*([)\]}])/g, '$1')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .trim()
  )
}

const count = items => {
  const bag = new Map()
  for (const item of items) bag.set(item, (bag.get(item) ?? 0) + 1)
  return bag
}

const only = (a, b, tag) => {
  const out = []
  for (const [chunk, n] of a) {
    const extra = n - (b.get(chunk) ?? 0)
    for (let i = 0; i < extra; i++) out.push(`${tag} ${chunk}`)
  }
  return out
}

const ref = count(toChunks(readFileSync(process.env.REF, 'utf8')))
const gen = count(toChunks(readFileSync(process.env.GEN, 'utf8')))
const residue = [...only(ref, gen, '<'), ...only(gen, ref, '>')]
writeFileSync(process.env.NORM_OUT, residue.join('\n') + (residue.length ? '\n' : ''))
console.log(residue.length)
