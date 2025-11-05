import { Command, EnumType } from '@cliffy/command'

// Sentry.init({
//   dsn: 'https://9904234a7aabfeff2145622ccb0824e3@o4508018789646336.ingest.de.sentry.io/4509532871262288'
// })

const run = async () => {
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
      const { renderGenerate } = await import('@/commands/generate.tsx')
      await renderGenerate({ projectName, schemaSourceString, watch })
    })

  const workerCommand = new Command()
    .description('Web worker proof of concept - test generator execution in isolated worker')
    .arguments('<project:string>')
    .action(async (_options, projectName) => {
      const { renderWorker } = await import('./commands/worker.ts')
      await renderWorker({ projectName })
    })

  await new Command()
    .description('Generate code from OpenAPI schema')
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
    .command('worker', workerCommand)
    .parse(Deno.args)
}

run()
