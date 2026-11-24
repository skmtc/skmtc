import { assertEquals, assertStringIncludes } from '@std/assert'
import { toCloneConflictText } from '@/lib/clone-headless.ts'
import { CoreConflictError } from '@/lib/stack-core.ts'

Deno.test('toCloneConflictText - names a local copy in the way, and a command that replaces it', () => {
  const text = toCloneConflictText({
    error: new CoreConflictError([
      {
        generatorId: '@skmtc/gen-typescript',
        range: '0.28.0',
        localPath: './gen-typescript'
      },
      { generatorId: '@skmtc/gen-zod', range: '^0.44.2' }
    ]),
    projectName: 'my-api',
    generators: ['@skmtc/gen-zod@0.4.6']
  })

  assertStringIncludes(
    text,
    '@skmtc/gen-typescript needs @skmtc/core 0.28.0 (local copy in ./gen-typescript)'
  )
  assertStringIncludes(
    text,
    'A local copy keeps the @skmtc/core its own deno.json names: @skmtc/gen-typescript.'
  )
  // A created generator has no published version, so replacing is only offered for a clone.
  assertStringIncludes(text, 'if the copy is a clone of a published generator')
  // --no-input: in a terminal, the picker cannot name a local copy.
  assertStringIncludes(
    text,
    '  skmtc clone my-api -g @skmtc/gen-zod@0.4.6 -g @skmtc/gen-typescript --no-input'
  )
  assertStringIncludes(text, 'Pass --force to clone without this check.')
})

Deno.test('toCloneConflictText - only published generators: names --force and no local copy', () => {
  const error = new CoreConflictError([
    { generatorId: '@skmtc/gen-typescript', range: '^0.28.0' },
    { generatorId: '@skmtc/gen-zod', range: '^0.44.2' }
  ])

  assertEquals(
    toCloneConflictText({ error, projectName: 'my-api', generators: ['@skmtc/gen-zod'] }),
    `${error.message}\n\nPass --force to clone without this check.`
  )
})
