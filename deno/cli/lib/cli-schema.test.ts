import { assertEquals } from '@std/assert/equals'
import { assert } from '@std/assert'
import {
  AGENT_MODE_FLAGS,
  COMMAND_DESCRIPTORS,
  getCommandDescriptor,
  toArgsString
} from '@/lib/cli-schema.ts'

Deno.test('cli-schema - every descriptor has a unique name', () => {
  // Duplicate command names in the schema would silently shadow each
  // other inside `getCommandDescriptor`. Catch this at test time.
  const names = COMMAND_DESCRIPTORS.map(c => c.name)
  const unique = new Set(names)
  assertEquals(names.length, unique.size)
})

Deno.test('cli-schema - getCommandDescriptor throws on unknown names', () => {
  let caught: unknown
  try {
    getCommandDescriptor('nonexistent-command-xyz')
  } catch (e) {
    caught = e
  }
  assert(caught instanceof Error)
  assert((caught as Error).message.includes('Unknown command name'))
})

Deno.test('cli-schema - every `full`-agentMode command carries the AGENT_MODE_FLAGS pair', () => {
  // The point of agent-mode is consistency. If a command claims
  // `agentMode: 'full'` it must declare both `--json` and
  // `--no-input` in its flag list (or include AGENT_MODE_FLAGS).
  const fullModeCommands = COMMAND_DESCRIPTORS.filter(c => c.agentMode === 'full')
  for (const cmd of fullModeCommands) {
    const flagNames = cmd.flags.map(f => f.flag)
    assert(
      flagNames.includes('--json'),
      `Command "${cmd.name}" claims agentMode 'full' but doesn't declare --json. ` +
        `Add AGENT_MODE_FLAGS to its flags array in cli-schema.ts.`
    )
    assert(
      flagNames.includes('--no-input'),
      `Command "${cmd.name}" claims agentMode 'full' but doesn't declare --no-input. ` +
        `Add AGENT_MODE_FLAGS to its flags array in cli-schema.ts.`
    )
  }
})

Deno.test('cli-schema - AGENT_MODE_FLAGS is exactly --json + --no-input', () => {
  // If we ever rename or add to AGENT_MODE_FLAGS this test will flag
  // every consumer that needs to be re-verified (mod.ts inline-flag
  // strings, skill docs, agent-context output).
  assertEquals(AGENT_MODE_FLAGS.length, 2)
  assertEquals(AGENT_MODE_FLAGS[0].flag, '--json')
  assertEquals(AGENT_MODE_FLAGS[1].flag, '--no-input')
})

Deno.test('cli-schema - toArgsString joins args with spaces', () => {
  assertEquals(
    toArgsString({
      name: 'x',
      description: 'x',
      args: ['<a>', '[b]', '[c...]'],
      flags: [],
      agentMode: 'none'
    }),
    '<a> [b] [c...]'
  )
})

Deno.test('cli-schema - toArgsString handles empty args', () => {
  assertEquals(
    toArgsString({
      name: 'x',
      description: 'x',
      args: [],
      flags: [],
      agentMode: 'none'
    }),
    ''
  )
})
