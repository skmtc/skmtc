import { assert } from '@std/assert'
import { assertEquals } from '@std/assert/equals'
import { toGuideOutput } from '@/commands/guide.ts'
import { COMMAND_DESCRIPTORS } from '@/lib/cli-schema.ts'
import { findGuideTopic, formatGuideIndex, GUIDE_TOPICS, toGuideIndex } from '@/lib/guide.ts'
import { shouldSkipRegistryCheck } from '@/lib/registry-check.ts'

Deno.test('guide - each topic has an id of its own, a summary and a body that starts with its title', () => {
  const ids = GUIDE_TOPICS.map(topic => topic.id)

  assertEquals(new Set(ids).size, ids.length)

  for (const topic of GUIDE_TOPICS) {
    assert(topic.summary.length > 0, `${topic.id} has no summary`)
    assert(topic.body.split('\n')[0].endsWith(topic.title), `${topic.id} does not start with its title`)
  }
})

Deno.test('guide - the list names each topic once, under its group', () => {
  const index = toGuideIndex({ cliVersion: '1.2.3' })
  const text = formatGuideIndex(index)
  const lines = text.split('\n')

  assertEquals(lines[0], 'Skmtc guide (CLI 1.2.3). Read a topic with: skmtc guide <topic>')

  for (const topic of index.topics) {
    assertEquals(lines.filter(line => line.trimStart().startsWith(`${topic.id} `)).length, 1)
  }

  assertEquals(
    lines.filter(line => line !== '' && !line.startsWith(' ')).slice(1),
    ['concepts', 'reference', 'tasks']
  )
})

Deno.test('guide - no topic prints the list, as text or as JSON without the bodies', () => {
  const text = toGuideOutput({ topicId: undefined, format: 'text', cliVersion: '1.2.3' })
  const json = toGuideOutput({ topicId: undefined, format: 'json', cliVersion: '1.2.3' })

  assertEquals(text, formatGuideIndex(toGuideIndex({ cliVersion: '1.2.3' })))

  const parsed = JSON.parse(json ?? '')

  assertEquals(parsed.type, 'guide-index')
  assertEquals(parsed.cliVersion, '1.2.3')
  assertEquals(parsed.topics.length, GUIDE_TOPICS.length)
  assertEquals(Object.keys(parsed.topics[0]), ['id', 'group', 'title', 'summary'])
})

Deno.test('guide - a topic prints its Markdown as text, and the whole topic as JSON', () => {
  const topic = findGuideTopic('setup')

  assert(topic !== undefined)
  assertEquals(toGuideOutput({ topicId: 'setup', format: 'text', cliVersion: '1.2.3' }), topic.body)

  const json = toGuideOutput({ topicId: 'setup', format: 'json', cliVersion: '1.2.3' })

  assertEquals(JSON.parse(json ?? ''), { type: 'guide-topic', cliVersion: '1.2.3', ...topic })
})

Deno.test('guide - an id that no topic has gives no output, so the command can fail with a recipe', () => {
  assertEquals(toGuideOutput({ topicId: 'nope', format: 'text', cliVersion: '1.2.3' }), undefined)
})

// The trap: a command that is not on the skip list first asks the registry,
// and the guide is what an agent reads when the network is the problem.
Deno.test('guide - skips the registry check, so it prints with no network', () => {
  assertEquals(shouldSkipRegistryCheck(['guide']), true)
  assertEquals(shouldSkipRegistryCheck(['guide', 'setup', '--json']), true)
})

Deno.test('guide - the schema declares the topic argument and --json, which agent-context reports', () => {
  const descriptor = COMMAND_DESCRIPTORS.find(command => command.name === 'guide')

  assertEquals(descriptor?.args, ['[topic]'])
  assertEquals(descriptor?.flags.map(flag => flag.flag), ['--json'])
  assertEquals(descriptor?.agentMode, 'json-only')
})
