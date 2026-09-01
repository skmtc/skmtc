/**
 * `skmtc trace <file>:<line>[:<col>] [project]` — which producers,
 * generator, and schema element wrote this position of a generated file,
 * from the last generate's provenance maps. Agent-first: strict mode only
 * (no Ink variant), `--json` for the structured answer.
 *
 * Exit codes:
 *   - `0` — answered (including an empty chain, which is a real answer)
 *   - `1` — could not answer (unknown file/project, unreadable input)
 *   - `2` — malformed invocation (bad `<location>` syntax)
 */

import { runTrace, type TraceResult, type TraceSuccess } from '@/lib/trace-headless.ts'
import { resolveOutputFormat } from '@/lib/strict-mode.ts'
import { toAbsoluteRootPath } from '@/lib/to-root-path.ts'
import { recordAgentUsage } from '@/lib/agent-usage.ts'

type RenderTraceArgs = {
  location: string
  project?: string
  jsonFlag?: boolean
}

export const renderTrace = async ({ location, project, jsonFlag }: RenderTraceArgs): Promise<void> => {
  const root = toAbsoluteRootPath()
  const result = await runTrace({ root, project, location })
  await recordAgentUsage(root, {
    verb: 'trace',
    args: location,
    project: result.type === 'traced' ? result.project : project,
    outcome: result.type
  })
  printTraceResult(result, { format: resolveOutputFormat({ jsonFlag }) })
  Deno.exit(toExitCode(result))
}

const toExitCode = (result: TraceResult): number => {
  if (result.type === 'traced') return 0
  return result.message.includes('not <file>:<line>') ? 2 : 1
}

type PrintOptions = { format: 'text' | 'json' }

export const printTraceResult = (result: TraceResult, { format }: PrintOptions): void => {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  if (result.type === 'trace-failed') {
    console.error(`trace failed: ${result.message}`)
    if (result.hint !== undefined) console.error(`hint: ${result.hint}`)
    return
  }
  printTraced(result)
}

const printTraced = (result: TraceSuccess): void => {
  const { freshness } = result
  console.log(`${result.file}:${result.position.line}:${result.position.column} (${result.project})`)
  console.log(
    `generated: ${freshness.generatedAt ?? 'never'} · maps: ${freshness.mapsPresent ? 'present' : 'absent'} · stale files: ${freshness.staleFileCount}`
  )
  if (freshness.invariants.emptyOutputWithSuccess) {
    console.log(
      `⚠ ${freshness.invariants.emptyFileCount} EMPTY file(s) beside ${freshness.invariants.successCount} success result(s) — do not trust this run's output`
    )
  }
  for (const note of result.notes) console.log(`note: ${note}`)
  if (result.chain.length === 0) {
    console.log('(no span captured at this position)')
    return
  }
  console.log('')
  for (const hop of result.chain) {
    const pointer = hop.schemaPointer === '' ? '(unattributed)' : hop.schemaPointer
    const source = hop.producerSource === null ? '' : `  ← ${hop.producerSource}`
    console.log(`  ${hop.producer} · ${hop.generator} · ${pointer} · ${hop.variant}${source}`)
  }
}
