// Usage telemetry for the agent-facing verbs: one JSONL line per
// invocation, appended to `<root>/.skmtc/agent-usage.ndjson`. Local-only,
// fire-and-forget, never throws — its job is to make "is this being used?"
// answerable from the tool's own records rather than transcript archaeology
// (the F8 lesson: count invocations at the tool, not substring mentions).

import { join } from 'node:path'

export type AgentUsageRecord = {
  verb: string
  args: string
  project?: string
  outcome: string
}

export const recordAgentUsage = async (
  root: string,
  { verb, args, project, outcome }: AgentUsageRecord
): Promise<void> => {
  try {
    const line = `${JSON.stringify({
      at: new Date().toISOString(),
      verb,
      args,
      ...(project === undefined ? {} : { project }),
      outcome
    })}\n`
    await Deno.writeTextFile(join(root, '.skmtc', 'agent-usage.ndjson'), line, { append: true })
  } catch {
    // Telemetry must never affect the command.
  }
}
