/**
 * `skmtc agent-context` — non-interactive passive introspection.
 *
 * Sibling to `doctor`; together they form Investment 2 from the
 * agent-CLI proposal:
 *   - `doctor`        → "is anything wrong?"   (active checks)
 *   - `agent-context` → "what do you have?"   (passive snapshot)
 *
 * Always non-interactive. Text mode mirrors the JSON shape for
 * humans; agents should prefer `--json` for stability.
 */

import { runAgentContext, type AgentContext } from '@/lib/agent-context-headless.ts'
import { resolveOutputFormat } from '@/lib/strict-mode.ts'
import denoJson from '../deno.json' with { type: 'json' }

type RenderAgentContextArgs = {
  jsonFlag?: boolean
}

export const renderAgentContext = ({ jsonFlag }: RenderAgentContextArgs): void => {
  const result = runAgentContext({ cliVersion: denoJson.version })
  printAgentContext(result, { format: resolveOutputFormat({ jsonFlag }) })
  Deno.exit(0)
}

type PrintOptions = { format: 'text' | 'json' }

export const printAgentContext = (ctx: AgentContext, { format }: PrintOptions): void => {
  switch (format) {
    case 'json': {
      console.log(JSON.stringify(ctx, null, 2))
      return
    }
    case 'text': {
      console.log(`SKMTC agent-context (CLI ${ctx.cliVersion})`)
      console.log(`  SKMTC root:       ${ctx.skmtcRootPath}`)
      console.log(`  Global state dir: ${ctx.globalStateDir}`)
      console.log(`  JSR URL:          ${ctx.jsrUrl}`)
      console.log('')
      console.log(`Projects (${ctx.projects.length}):`)
      if (ctx.projects.length === 0) {
        console.log('  (none — run `skmtc init <project> <basePath>` to create one)')
      }
      for (const project of ctx.projects) {
        console.log(`  - ${project.name}`)
        console.log(`      basePath:     ${project.basePath ?? '(unset)'}`)
        console.log(`      schemaSource: ${project.schemaSource ?? '(unset)'}`)
        if (project.generators.remote.length > 0) {
          console.log(`      remote:       ${project.generators.remote.join(', ')}`)
        }
        if (project.generators.local.length > 0) {
          console.log(`      local:        ${project.generators.local.join(', ')}`)
        }
      }
      console.log('')
      console.log(`Commands (${ctx.commands.length}):`)
      for (const cmd of ctx.commands) {
        const argList = cmd.args.length > 0 ? ' ' + cmd.args.join(' ') : ''
        const flagList = cmd.flags.length > 0
          ? '   [' + cmd.flags.map(f => f.flag).join(' | ') + ']'
          : ''
        console.log(`  skmtc ${cmd.name}${argList}${flagList}`)
        console.log(`      ${cmd.description}  (agent-mode: ${cmd.agentMode})`)
      }
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
