import { Command, type StringType } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { Generator } from '../lib/generator.ts'
import { RootDenoJson } from '../lib/root-deno-json.ts'
import { StackJson } from '../lib/stack-json.ts'
import { Manager } from '../lib/manager.ts'
import * as Sentry from '@sentry/deno'

type CommandType = Command<
  void,
  void,
  void,
  [StringType & string],
  void,
  {
    number: number
    integer: number
    string: string
    boolean: boolean
    file: string
  },
  void,
  undefined
>

export const description = 'Remove a generator from the stack'

export const toRemoveCommand = (): CommandType => {
  const command = new Command()
    .description(description)
    .example('Remove RTK Query generator from the stack', 'remove @skmtc/rtk-query')
    .arguments('<generator:string>')
    .action((_options, generator) => remove(generator))

  return command
}

export const toRemovePrompt = async () => {
  const stackJson = await StackJson.open()

  const generator: string = await Input.prompt({
    message: 'Remove a generator from the stack',
    list: true,
    suggestions: stackJson.contents.generators
  })

  await remove(generator, { logSuccess: `Generator "${generator}" is created` })
}

type RemoveOptions = {
  logSuccess?: string
}

// Should user be logged in to create a generator so we can use their account name as the scope name?
// Might be easier to let them pick any scope name since it is just a JSR value?
// Suggest scope name if they are logged in?
const remove = async (packageName: string, { logSuccess }: RemoveOptions = {}) => {
  const kv = await Deno.openKv()
  const manager = new Manager({ kv, logSuccess })

  try {
    const { scopeName, generatorName, version } = Generator.parseName(packageName)

    const generator = Generator.fromName({ scopeName, generatorName, version: version ?? '' })

    const denoJson = await RootDenoJson.open(manager)
    const stackJson = await StackJson.open(manager)

    generator.remove(denoJson, stackJson)

    await manager.success()
  } catch (error) {
    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to remove generator')
  }
}
