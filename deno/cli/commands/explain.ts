/**
 * `skmtc explain <subject> <name> [project]` — explain a provenance
 * subject from the last generate:
 *
 *   - `producer <Class>` — real output samples + class source + counts
 *   - `ref <Name>`      — which generator/artifact settled a definition name
 *
 * Agent-first, strict mode only. Exit codes match `trace`:
 * `0` answered, `1` could not answer, `2` malformed invocation.
 */

import { explainProducer, explainRef, type ExplainResult } from '@/lib/explain-headless.ts'
import { resolveOutputFormat } from '@/lib/strict-mode.ts'
import { toAbsoluteRootPath } from '@/lib/to-root-path.ts'
import { recordAgentUsage } from '@/lib/agent-usage.ts'

type RenderExplainArgs = {
  subject: string
  name: string
  project?: string
  generator?: string
  jsonFlag?: boolean
}

export const renderExplain = async ({
  subject,
  name,
  project,
  generator,
  jsonFlag
}: RenderExplainArgs): Promise<void> => {
  const format = resolveOutputFormat({ jsonFlag })
  const root = toAbsoluteRootPath()

  if (subject !== 'producer' && subject !== 'ref') {
    const failure: ExplainResult = {
      type: 'explain-failed',
      message: `Unknown subject '${subject}' — expected 'producer' or 'ref'.`,
      hint: 'Examples: skmtc explain producer ZodObject --json · skmtc explain ref ApiErrorModel --json'
    }
    printExplainResult(failure, { format })
    Deno.exit(2)
  }

  const result =
    subject === 'producer'
      ? await explainProducer({ root, project, className: name, generator })
      : await explainRef({ root, project, name })
  await recordAgentUsage(root, {
    verb: 'explain',
    args: `${subject} ${name}`,
    project: 'project' in result ? result.project : project,
    outcome: result.type
  })
  printExplainResult(result, { format })
  Deno.exit(result.type === 'explain-failed' ? 1 : 0)
}

type PrintOptions = { format: 'text' | 'json' }

export const printExplainResult = (result: ExplainResult, { format }: PrintOptions): void => {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  switch (result.type) {
    case 'explain-failed': {
      console.error(`explain failed: ${result.message}`)
      if (result.hint !== undefined) console.error(`hint: ${result.hint}`)
      return
    }
    case 'producer-explained': {
      console.log(
        `${result.className} (${result.project}) — ${result.spanCount} span(s) across ${result.fileCount} file(s), generated ${result.freshness.generatedAt ?? 'never'}`
      )
      for (const source of result.sources) console.log(`  declared: ${source}`)
      for (const note of result.notes) console.log(`note: ${note}`)
      for (const sample of result.samples) {
        const pointer = sample.schemaPointer === '' ? '(unattributed)' : sample.schemaPointer
        console.log(`\n  ${sample.artifactPath} · ${pointer} · ${sample.variant}`)
        console.log(
          sample.code
            .split('\n')
            .map(line => `    ${line}`)
            .join('\n') + (sample.truncated ? '\n    …' : '')
        )
      }
      return
    }
    case 'ref-explained': {
      console.log(
        `${result.name} (${result.project}) — ${result.definitions.length} definition(s), generated ${result.freshness.generatedAt ?? 'never'}`
      )
      for (const definition of result.definitions) {
        const pointer = definition.schemaPointer === '' ? '(unattributed)' : definition.schemaPointer
        console.log(
          `  ${definition.artifactPath} · ${definition.generator} · ${pointer} · ${definition.variant}`
        )
      }
      for (const note of result.notes) console.log(`note: ${note}`)
      return
    }
    default: {
      const _exhaustive: never = result
      throw new Error(`Unhandled explain result: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
