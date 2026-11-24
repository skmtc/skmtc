import { assertEquals, assertStringIncludes } from '@std/assert'
import { toCloneConflictText } from '@/lib/clone-headless.ts'
import { CoreConflictError } from '@/lib/stack-core.ts'

Deno.test('toCloneConflictText - names a local copy in the way, and both ways past it', () => {
  const text = toCloneConflictText(
    new CoreConflictError([
      {
        generatorId: '@skmtc/gen-typescript',
        range: '0.28.0',
        localPath: './gen-typescript'
      },
      { generatorId: '@skmtc/gen-zod', range: '^0.44.2' }
    ])
  )

  assertStringIncludes(
    text,
    '@skmtc/gen-typescript needs @skmtc/core 0.28.0 (local copy in ./gen-typescript)'
  )
  assertStringIncludes(
    text,
    'A local copy keeps the @skmtc/core its own deno.json names: @skmtc/gen-typescript.'
  )
  assertStringIncludes(text, 'name the copy in the same clone command')
  assertStringIncludes(text, 'Pass --force to clone without this check.')
})

Deno.test('toCloneConflictText - only published generators: names --force and no local copy', () => {
  const error = new CoreConflictError([
    { generatorId: '@skmtc/gen-typescript', range: '^0.28.0' },
    { generatorId: '@skmtc/gen-zod', range: '^0.44.2' }
  ])

  assertEquals(
    toCloneConflictText(error),
    `${error.message}\n\nPass --force to clone without this check.`
  )
})
