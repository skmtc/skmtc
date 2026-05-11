import { Command, EnumType } from '@cliffy/command'
import { assertJsrReachable, JsrRegistryUnreachableError } from '@/lib/jsr-registry.ts'

// Sentry.init({
//   dsn: 'https://9904234a7aabfeff2145622ccb0824e3@o4508018789646336.ingest.de.sentry.io/4509532871262288'
// })

// Commands that never touch JSR can be allow-listed here so they keep
// working offline. Adding new commands defaults to "requires registry"
// — make it an explicit decision when something can skip the check.
const COMMANDS_THAT_SKIP_REGISTRY_CHECK = new Set<string>(['generate', 'dev'])

const shouldSkipRegistryCheck = (args: readonly string[]): boolean => {
  const firstArg = args.find(arg => !arg.startsWith('-'))
  if (!firstArg) return false
  return COMMANDS_THAT_SKIP_REGISTRY_CHECK.has(firstArg)
}

const run = async () => {
  if (!shouldSkipRegistryCheck(Deno.args)) {
    try {
      await assertJsrReachable()
    } catch (error) {
      if (error instanceof JsrRegistryUnreachableError) {
        console.error(error.message)
        Deno.exit(1)
      }
      throw error
    }
  }

  const generatorType = new EnumType(['operation', 'model'])
  // Dynamic command wrappers - commands are loaded only when executed

  const initCommand = new Command()
    .description('Initialize a new project in current directory')
    .arguments('[projectName:string] [basePath:string]')
    .action(async (_options, projectName, basePath) => {
      const { renderInit } = await import('@/commands/init.tsx')
      await renderInit({ projectName, basePath })
    })

  const createCommand = new Command()
    .description('Create new generator')
    .type('generatorType', generatorType)
    .arguments('<project:string> <generator:string> <type:generatorType>')
    .action(async (_options, projectName, generator, type) => {
      const { renderCreate } = await import('@/commands/create.tsx')
      await renderCreate({ projectName, generator, type })
    })

  const cloneCommand = new Command()
    .description('Clone generator')
    .arguments('<project:string>')
    .action(async (_options, projectName) => {
      const { renderClone } = await import('@/commands/clone.tsx')
      await renderClone({ projectName })
    })

  const installCommand = new Command()
    .description('Install generator')
    .arguments('[generators:string[]] [project:string]')
    .action(async (_options, generators, projectName) => {
      const { renderInstall } = await import('@/commands/install.tsx')
      await renderInstall({ generators, projectName })
    })

  const listCommand = new Command()
    .description('List generators')
    .arguments('<project:string>')
    .action(async (_options, projectName) => {
      const { renderList } = await import('@/commands/list.tsx')
      await renderList({ projectName })
    })

  const removeCommand = new Command()
    .description('Remove generator')
    .arguments('<project:string> <generator:string>')
    .action(async (_options, projectName, generator) => {
      const { renderRemove } = await import('@/commands/remove.tsx')
      await renderRemove({ projectName, generator })
    })

  const generateCommand = new Command()
    .description('Generate artifacts')
    .arguments('<project:string> [schema:string]')
    .option('-w, --watch', 'Watch for changes to schema and generate artifacts')
    .action(async ({ watch }, projectName, schemaSourceString) => {
      const { generateSwitch } = await import('@/commands/generate-switch.ts')

      await generateSwitch({ projectName, schemaSourceString, watch })
    })

  const bundleCommand = new Command()
    .description('Create bundle from project')
    .arguments('<project:string>')
    .action(async (_options, projectName) => {
      const { renderBundle } = await import('@/commands/bundle.tsx')

      await renderBundle({ projectName })
    })

  const devCommand = new Command()
    .description('Watch project files, rebundle and regenerate on change')
    .arguments('<project:string> [schema:string]')
    .action(async (_options, projectName, schemaSourceString) => {
      const { dev } = await import('@/commands/dev.ts')

      await dev({ projectName, schemaSourceString })
    })

  await new Command()
    .description('Generate code from an OpenAPI or GraphQL schema')
    .action(async _flags => {
      const { runPrompt } = await import('@/prompt/run-prompt.tsx')
      await runPrompt()
    })
    .command('init', initCommand)
    .command('create', createCommand)
    .command('clone', cloneCommand)
    .command('install', installCommand)
    .command('list', listCommand)
    .command('remove', removeCommand)
    .command('generate', generateCommand)
    .command('bundle', bundleCommand)
    .command('dev', devCommand)
    .parse(Deno.args)
}

run()
