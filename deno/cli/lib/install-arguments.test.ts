import { Command } from '@cliffy/command'
import { assertEquals } from '@std/assert'
import { INSTALL_ARGUMENTS, toInstallArguments } from '@/lib/install-arguments.ts'

const parseInstall = async (args: string[]) => {
  const { args: values } = await new Command()
    .throwErrors()
    .arguments(INSTALL_ARGUMENTS)
    .option('--no-input', 'Disable interactive prompts.')
    .option('--json', 'Emit JSON.')
    .parse(args)

  return toInstallArguments(values)
}

Deno.test('install arguments - two generators and a project in one call', async () => {
  assertEquals(await parseInstall(['@skmtc/gen-zod', '@skmtc/gen-typescript', 'my-api']), {
    generators: ['@skmtc/gen-zod', '@skmtc/gen-typescript'],
    projectName: 'my-api'
  })
})

Deno.test('install arguments - flags alongside several generators', async () => {
  assertEquals(
    await parseInstall([
      '@skmtc/gen-zod',
      '@skmtc/gen-typescript',
      'my-api',
      '--json',
      '--no-input'
    ]),
    {
      generators: ['@skmtc/gen-zod', '@skmtc/gen-typescript'],
      projectName: 'my-api'
    }
  )
})

Deno.test('install arguments - one generator and a project', async () => {
  assertEquals(await parseInstall(['@skmtc/gen-zod', 'my-api']), {
    generators: ['@skmtc/gen-zod'],
    projectName: 'my-api'
  })
})

Deno.test('install arguments - comma-separated generators still work', async () => {
  assertEquals(await parseInstall(['@skmtc/gen-zod,@skmtc/gen-typescript', 'my-api']), {
    generators: ['@skmtc/gen-zod', '@skmtc/gen-typescript'],
    projectName: 'my-api'
  })
})

Deno.test('install arguments - a single positional is the generator list', async () => {
  assertEquals(await parseInstall(['@skmtc/gen-zod']), {
    generators: ['@skmtc/gen-zod'],
    projectName: undefined
  })
})

Deno.test('install arguments - no positionals leaves both unset', async () => {
  assertEquals(await parseInstall([]), { generators: undefined, projectName: undefined })
})
