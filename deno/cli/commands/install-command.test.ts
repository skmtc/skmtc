import { assertEquals } from '@std/assert'
import { toInstallCommand } from '@/commands/install-command.ts'
import type { InstallAction } from '@/commands/install-command.ts'

const parseInstall = async (args: string[]) => {
  const calls: Parameters<InstallAction>[0][] = []
  await toInstallCommand(received => {
    calls.push(received)
    return Promise.resolve()
  })
    .throwErrors()
    .parse(args)

  assertEquals(calls.length, 1)
  return calls[0]
}

Deno.test('install command - two generators and a project in one call', async () => {
  assertEquals(await parseInstall(['@skmtc/gen-zod', '@skmtc/gen-typescript', 'my-api']), {
    generators: ['@skmtc/gen-zod', '@skmtc/gen-typescript'],
    projectName: 'my-api',
    unrecognized: [],
    jsonFlag: undefined,
    noInputFlag: false
  })
})

Deno.test('install command - flags alongside several generators', async () => {
  const received = await parseInstall([
    '@skmtc/gen-zod',
    'jsr:@skmtc/gen-typescript@^0.2.7',
    'my-api',
    '--json',
    '--no-input'
  ])

  assertEquals(received.generators, ['@skmtc/gen-zod', 'jsr:@skmtc/gen-typescript@^0.2.7'])
  assertEquals(received.projectName, 'my-api')
  assertEquals(received.jsonFlag, true)
  assertEquals(received.noInputFlag, true)
})

Deno.test('install command - comma-separated generators still work', async () => {
  const received = await parseInstall(['@skmtc/gen-zod,@skmtc/gen-typescript', 'my-api'])

  assertEquals(received.generators, ['@skmtc/gen-zod', '@skmtc/gen-typescript'])
  assertEquals(received.projectName, 'my-api')
})

Deno.test('install command - generators without a project leave the project unset', async () => {
  const received = await parseInstall(['@skmtc/gen-zod', '@skmtc/gen-typescript', '--no-input'])

  assertEquals(received.generators, ['@skmtc/gen-zod', '@skmtc/gen-typescript'])
  assertEquals(received.projectName, undefined)
  assertEquals(received.unrecognized, [])
})

Deno.test('install command - a project alone is the project, not a generator', async () => {
  const received = await parseInstall(['my-api', '--no-input'])

  assertEquals(received.generators, undefined)
  assertEquals(received.projectName, 'my-api')
})

Deno.test('install command - the project may come first', async () => {
  const received = await parseInstall(['my-api', '@skmtc/gen-zod'])

  assertEquals(received.generators, ['@skmtc/gen-zod'])
  assertEquals(received.projectName, 'my-api')
})

Deno.test('install command - more than one non-specifier is reported', async () => {
  const received = await parseInstall(['gen-zod', 'my-api'])

  assertEquals(received.generators, undefined)
  assertEquals(received.projectName, undefined)
  assertEquals(received.unrecognized, ['gen-zod', 'my-api'])
})

Deno.test('install command - no positionals leaves everything unset', async () => {
  assertEquals(await parseInstall([]), {
    generators: undefined,
    projectName: undefined,
    unrecognized: [],
    jsonFlag: undefined,
    noInputFlag: false
  })
})

Deno.test('install command - help usage matches the descriptor', () => {
  assertEquals(toInstallCommand().getUsage(), '[generators...] [project]')
})
