import { assertEquals, assertThrows } from '@std/assert'
import {
  buildGuideTopics,
  findCodeUses,
  findUnknownCommands,
  parseGuideSource
} from './guide-topics.ts'

const TASKS = `<!-- topic setup: Create a project and generate -->
## Setting up

Run \`skmtc init\`.

<!-- topic clean: Delete the generated files -->
## Cleaning

Run \`skmtc clean\`.
`

Deno.test('a topic runs from its marker to the next marker, and takes its title from its heading', () => {
  assertEquals(parseGuideSource({ name: 'tasks.md', text: TASKS }), [
    {
      id: 'setup',
      group: 'tasks',
      title: 'Setting up',
      summary: 'Create a project and generate',
      body: '## Setting up\n\nRun `skmtc init`.'
    },
    {
      id: 'clean',
      group: 'tasks',
      title: 'Cleaning',
      summary: 'Delete the generated files',
      body: '## Cleaning\n\nRun `skmtc clean`.'
    }
  ])
})

// The trap: text above the first marker would be in the source, read by
// its author as part of the guide, and printed by no topic.
Deno.test('text before the first marker is an error, with its line', () => {
  assertThrows(
    () => parseGuideSource({ name: 'tasks.md', text: `\nAn intro.\n\n${TASKS}` }),
    Error,
    'tasks.md:2: text before the first topic marker'
  )
})

Deno.test('a marker with a wrong shape is an error, not text of the topic before it', () => {
  assertThrows(
    () =>
      parseGuideSource({ name: 'tasks.md', text: `${TASKS}\n<!-- topic Deploy -->\n## Deploy\n` }),
    Error,
    'tasks.md:11: a topic marker is'
  )
})

// The trap: an indented marker would be text of the topic before it, and the
// topic it was meant to start would be missing with no error.
Deno.test('an indented marker is an error', () => {
  assertThrows(
    () =>
      parseGuideSource({
        name: 'tasks.md',
        text: `${TASKS}\n <!-- topic deploy: Deploy -->\n## Deploy\n`
      }),
    Error,
    'tasks.md:11: a topic marker is'
  )
})

Deno.test('a marker in a code block is an example, and text of its topic', () => {
  const text = [
    '<!-- topic authoring: How to write a topic -->',
    '## Writing a topic',
    '',
    '```md',
    '<!-- topic setup: Create a project -->',
    '## Setting up',
    '```',
    ''
  ].join('\n')

  const topics = parseGuideSource({ name: 'concepts.md', text })

  assertEquals(
    topics.map(topic => topic.id),
    ['authoring']
  )
  assertEquals(topics[0].body.includes('<!-- topic setup: Create a project -->'), true)
})

// The trap: a `~~~` line in a ``` block would close the block, and the marker
// after it would start a topic.
Deno.test('a code block closes only at a fence like the one that opened it', () => {
  const text = [
    '<!-- topic authoring: How to write a topic -->',
    '## Writing a topic',
    '',
    '```md',
    '~~~',
    '<!-- topic setup: Create a project -->',
    '```',
    ''
  ].join('\n')

  const topics = parseGuideSource({ name: 'concepts.md', text })

  assertEquals(
    topics.map(topic => topic.id),
    ['authoring']
  )
})

Deno.test('a topic that does not start with a heading is an error', () => {
  assertThrows(
    () => parseGuideSource({ name: 'tasks.md', text: '<!-- topic setup: Set up -->\nRun it.\n' }),
    Error,
    'topic `setup` must start with a heading'
  )
})

Deno.test('an id used in two files is an error', () => {
  assertThrows(
    () =>
      buildGuideTopics([
        { name: 'concepts.md', text: '<!-- topic setup: One -->\n## One\n' },
        { name: 'tasks.md', text: TASKS }
      ]),
    Error,
    'guide topic `setup` is defined twice'
  )
})

// The trap: the guide ships inside the CLI, so a command it names that the
// CLI does not have sends a reader to an error.
Deno.test('a command in a code span or a code block that is not registered is found', () => {
  const body = [
    '## Deploying',
    '',
    'Run `skmtc deploy <project>`, then `skmtc promote <project>`.',
    '',
    '```bash',
    'skmtc login',
    '  skmtc ship my-api --json',
    '$ skmtc deploy my-api',
    '```'
  ].join('\n')

  const topics = [{ id: 'deploy', group: 'tasks', title: 'Deploying', summary: 'Deploy', body }]

  assertEquals(findUnknownCommands({ topics, commands: ['deploy', 'login'] }), [
    { topicId: 'deploy', command: 'promote' },
    { topicId: 'deploy', command: 'ship' }
  ])
})

// The trap: a sentence wraps, and its next line starts with "skmtc ignores".
// Read as a command, that fails the check for a guide with no fault.
Deno.test('a placeholder, a flag and the word skmtc in a sentence are not commands', () => {
  const body = [
    '## Commands',
    '',
    'A skmtc project holds generators. Run `skmtc <cmd> -h` or `skmtc --help`.',
    'When a project has both files,',
    'skmtc ignores the old one.',
    '',
    '```json',
    '{ "nextStep": "skmtc install <generators...> my-api" }',
    '```'
  ].join('\n')

  const topics = [{ id: 'commands', group: 'concepts', title: 'Commands', summary: 'List', body }]

  assertEquals(findUnknownCommands({ topics, commands: [] }), [])
})

Deno.test('a code span that wraps to the next line is read', () => {
  const text = 'A stack is deployed: `skmtc\ndeploy` stores a version. See `skmtc guide\noutput`.'

  assertEquals(findCodeUses({ text, prefix: 'skmtc' }), ['deploy', 'guide'])
  assertEquals(findCodeUses({ text, prefix: 'skmtc guide' }), ['output'])
})

Deno.test('a topic id is found in a code span and in a code block, and not in an error message', () => {
  const text = [
    'Read `skmtc guide contract` first.',
    '',
    '```',
    '$ skmtc guide pin-source',
    'skmtc guide setup',
    'Example: skmtc guide nope',
    '```'
  ].join('\n')

  assertEquals(findCodeUses({ text, prefix: 'skmtc guide' }), ['contract', 'pin-source', 'setup'])
})
