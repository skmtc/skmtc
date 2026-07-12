/**
 * Phase 0, spike 1b — producer-side parse time
 *
 * Measures per-file parse + anchor-resolution time for the AST
 * post-pass, on a real corpus of generated TS/TSX. Decides whether
 * the post-pass runs inline in `generate` or async after the JSON
 * response.
 *
 * Run:  deno run -A --node-modules-dir=auto scripts/spikes/parse-time-bench.ts [corpus-dir]
 *
 * Default corpus: openapi-codegen-benchmarks/.skmtc generated output.
 */

import ts from 'npm:typescript@5.6.3'
import { walk } from '@std/fs'
import { resolve } from '@std/path'

const DEFAULT_CORPUS = resolve(Deno.cwd(), '../../openapi-codegen-benchmarks')

type FileRecord = { path: string; bytes: number; lines: number; source: string }

async function loadCorpus(root: string, anyTs = false): Promise<FileRecord[]> {
  const out: FileRecord[] = []
  const matcher = anyTs ? undefined : [/\.generated\.(ts|tsx)$/]
  for await (const entry of walk(root, {
    exts: ['.ts', '.tsx'],
    match: matcher,
    includeDirs: false,
    skip: [/node_modules/, /\.test\.ts$/]
  })) {
    const source = await Deno.readTextFile(entry.path)
    out.push({
      path: entry.path,
      bytes: source.length,
      lines: source.split('\n').length,
      source
    })
  }
  return out
}

type ParseBench = { file: string; bytes: number; parseMs: number; resolveMs: number; nodes: number }

function benchTsc(record: FileRecord): ParseBench {
  const parseStart = performance.now()
  const sf = ts.createSourceFile(
    record.path,
    record.source,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    record.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const parseMs = performance.now() - parseStart

  // Approximate the anchor-resolution cost: walk every node once
  // (mirrors what the post-pass does when resolving each Span).
  const resolveStart = performance.now()
  let nodes = 0
  function walkNode(n: ts.Node) {
    nodes++
    n.forEachChild(walkNode)
  }
  sf.forEachChild(walkNode)
  const resolveMs = performance.now() - resolveStart

  return { file: record.path, bytes: record.bytes, parseMs, resolveMs, nodes }
}

function summarise(label: string, results: ParseBench[]) {
  const total = results.reduce(
    (a, r) => ({
      parseMs: a.parseMs + r.parseMs,
      resolveMs: a.resolveMs + r.resolveMs,
      bytes: a.bytes + r.bytes,
      nodes: a.nodes + r.nodes
    }),
    { parseMs: 0, resolveMs: 0, bytes: 0, nodes: 0 }
  )
  const sorted = [...results].sort((a, b) => b.parseMs + b.resolveMs - (a.parseMs + a.resolveMs))
  const p50 = sorted[Math.floor(sorted.length / 2)]
  const p95 = sorted[Math.floor(sorted.length * 0.05)]
  const max = sorted[0]

  console.log(`\n=== ${label} ===`)
  console.log(`  files:        ${results.length}`)
  console.log(`  total bytes:  ${total.bytes.toLocaleString()}`)
  console.log(`  total nodes:  ${total.nodes.toLocaleString()}`)
  console.log(`  total parse:  ${total.parseMs.toFixed(1)} ms`)
  console.log(`  total walk:   ${total.resolveMs.toFixed(1)} ms`)
  console.log(`  total combined: ${(total.parseMs + total.resolveMs).toFixed(1)} ms`)
  console.log(
    `  bytes/sec:    ${((total.bytes / (total.parseMs + total.resolveMs)) * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  )
  console.log(`  p50:          ${(p50.parseMs + p50.resolveMs).toFixed(2)} ms (${p50.bytes} bytes)`)
  console.log(`  p95:          ${(p95.parseMs + p95.resolveMs).toFixed(2)} ms (${p95.bytes} bytes)`)
  console.log(
    `  max:          ${(max.parseMs + max.resolveMs).toFixed(2)} ms (${max.bytes} bytes) — ${max.file.split('/').slice(-2).join('/')}`
  )
}

async function main() {
  const corpusDir = Deno.args[0] ?? DEFAULT_CORPUS
  const anyTs = Deno.args.includes('--any-ts')
  console.log(
    `Loading corpus from: ${corpusDir}${anyTs ? ' (all .ts/.tsx)' : ' (.generated.* only)'}`
  )
  const corpus = await loadCorpus(corpusDir, anyTs)
  if (corpus.length === 0) {
    console.error(`No .generated.ts/tsx files found in ${corpusDir}`)
    Deno.exit(2)
  }
  console.log(
    `Loaded ${corpus.length} files, total ${corpus.reduce((s, r) => s + r.bytes, 0).toLocaleString()} bytes`
  )

  // Warm-up: parse each file once (JIT, module init)
  for (const record of corpus) benchTsc(record)

  // Hot run: median of 3
  const runs: ParseBench[][] = []
  for (let i = 0; i < 3; i++) {
    runs.push(corpus.map(benchTsc))
  }
  const median = corpus.map((_, idx) => {
    const samples = runs
      .map(r => r[idx])
      .sort((a, b) => a.parseMs + a.resolveMs - (b.parseMs + b.resolveMs))
    return samples[1] // median of 3
  })

  summarise('tsc (typescript@5.6.3) — median of 3 hot runs', median)

  // Try oxc-parser if available
  try {
    const oxc = await import('npm:oxc-parser@0.41.0')
    const parseSync = oxc.parseSync
    if (typeof parseSync === 'function') {
      console.log('\nAttempting oxc-parser benchmark...')
      const oxcRuns: ParseBench[][] = []
      // Warm
      for (const record of corpus) {
        try {
          parseSync(record.path, record.source)
        } catch {}
      }
      for (let i = 0; i < 3; i++) {
        const round: ParseBench[] = []
        for (const record of corpus) {
          const parseStart = performance.now()
          try {
            const result = parseSync(record.path, record.source)
            const parseMs = performance.now() - parseStart
            // walk via JSON.parse for the AST traversal cost equivalence
            let nodes = 0
            const walkStart = performance.now()
            function walkAny(v: unknown) {
              if (v && typeof v === 'object') {
                nodes++
                for (const k of Object.keys(v as object)) {
                  walkAny((v as Record<string, unknown>)[k])
                }
              }
            }
            // oxc returns either {program, ...} or similar; walk whatever shape
            walkAny(result)
            const resolveMs = performance.now() - walkStart
            round.push({ file: record.path, bytes: record.bytes, parseMs, resolveMs, nodes })
          } catch (e) {
            console.error(
              `oxc parse failed for ${record.path}: ${e instanceof Error ? e.message : e}`
            )
          }
        }
        oxcRuns.push(round)
      }
      if (oxcRuns[0].length > 0) {
        const oxcMedian = oxcRuns[0].map((_, idx) => {
          const samples = oxcRuns
            .map(r => r[idx])
            .filter(Boolean)
            .sort((a, b) => a.parseMs + a.resolveMs - (b.parseMs + b.resolveMs))
          return samples[Math.floor(samples.length / 2)]
        })
        summarise('oxc-parser — median of 3 hot runs', oxcMedian)
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`\noxc-parser not available: ${msg}`)
    console.log('(Phase G will revisit oxc integration with the WASM build.)')
  }

  // Budget context: a typical `skmtc generate` for the bench schema
  // takes O(seconds). If parse + walk total is < 10% of that, inline
  // post-pass is fine.
  console.log('\n--- decision input ---')
  console.log('Inline post-pass acceptable if total parse+walk < 10% of `skmtc generate` runtime.')
  console.log(
    'If above 10%, Phase D should ship `--anchors-async` writing sidecars after the JSON response.'
  )
}

if (import.meta.main) {
  await main()
}
