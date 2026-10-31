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

Deno.test('cli-schema - deploy is a full agent-mode command with --existing', () => {
  const deploy = getCommandDescriptor('deploy')

  assertEquals(deploy.args, ['<project>'])
  assertEquals(deploy.agentMode, 'full')
  assertEquals(
    deploy.flags.map(f => f.flag.split(' ')[0]),
    ['--json', '--no-input', '--token', '--env', '--version', '--existing']
  )
  // A stack is deployed, never published; only the alias names `publish`.
  assert(!deploy.description.toLowerCase().includes('publish'))
  assert(getCommandDescriptor('publish').description.includes('`deploy`'))
})

Deno.test('cli-schema - api publish declares an optional <file> and its hub flags', () => {
  // A CI run discovers the command through agent-context. The file is
  // optional in Cliffy so a missing one reaches the recipe; the schema
  // must say the same.
  const apiPublish = getCommandDescriptor('api publish')

  assertEquals(apiPublish.args, ['[file]'])
  assertEquals(apiPublish.agentMode, 'full')
  assertEquals(
    apiPublish.flags.map(f => f.flag.split(' ')[0]),
    ['--json', '--no-input', '--api', '--visibility', '--origin-url', '--token', '--env']
  )
})

Deno.test('cli-schema - whoami and feedback declare their hub flags', () => {
  const flagsOf = (name: string) => getCommandDescriptor(name).flags.map(f => f.flag.split(' ')[0])

  assertEquals(flagsOf('whoami'), ['--json', '--no-input', '--token', '--env'])
  assertEquals(flagsOf('feedback'), [
    '--json',
    '--no-input',
    '--kind',
    '--summary',
    '--details',
    '--operation',
    '--resource',
    '--request-id',
    '--token',
    '--env'
  ])
})

Deno.test('cli-schema - api link declares no arguments and its hub flags', () => {
  const apiLink = getCommandDescriptor('api link')

  assertEquals(apiLink.args, [])
  assertEquals(apiLink.agentMode, 'full')
  assertEquals(
    apiLink.flags.map(f => f.flag.split(' ')[0]),
    [
      '--json',
      '--no-input',
      '--api',
      '--repo',
      '--workflow',
      '--environment',
      '--no-open',
      '--token',
      '--env'
    ]
  )
})

Deno.test('cli-schema - doctor declares --offline, which agents discover through this schema', () => {
  // `agent-context` prints these descriptors verbatim, and the audience
  // for `--offline` is an automated run — which reads the schema, not
  // `--help`. A flag wired into the Cliffy command but not declared here
  // is invisible to the only caller that wants it.
  const doctor = getCommandDescriptor('doctor')
  const flags = doctor.flags.map(f => f.flag)

  assertEquals(flags.includes('--json'), true)
  assertEquals(flags.includes('--offline'), true)
})
