import { Command, EnumType, type StringType } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { Generator } from '../lib/generator.ts'
import { DenoJson } from '../lib/deno-json.ts'
import { StackJson } from '../lib/stack-json.ts'
import { checkProjectName } from '@skmtc/core'
import { Manager } from '../lib/manager.ts'
import * as Sentry from '@sentry/deno'

type CommandType = Command<
  void,
  void,
  void,
  [StringType & string, EnumType<'operation' | 'model'>],
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

const generatorType = new EnumType(['operation', 'model'])

export const description = 'Add a new generator to the stack'

export const toAddCommand = (): CommandType => {
  const command = new Command()
    .description(description)
    .example('Add RTK Query generator from JSR registry', 'add jsr:@skmtc/rtk-query')
    .type('generator-type', generatorType)
    .arguments('<generator:string> <type:generator-type>')
    .action((_options, generator, type) => add(generator, type))

  return command
}

export const toAddPrompt = async () => {
  const generator: string = await Input.prompt({
    message: 'Generator name',
    validate: value => checkProjectName(value) ?? false
  })

  const type = await Input.prompt({
    message: 'Select generator type',
    list: true,
    suggestions: generatorType.values
  })

  await add(generator, type as 'operation' | 'model', {
    logSuccess: `Generator "${generator}" is created`
  })
}

type AddOptions = {
  logSuccess?: string
}

// Should user be logged in to create a generator so we can use their account name as the scope name?
// Might be easier to let them pick any scope name since it is just a JSR value?
// Suggest scope name if they are logged in?
const add = async (
  packageName: string,
  type: 'operation' | 'model',
  { logSuccess }: AddOptions = {}
) => {
  const kv = await Deno.openKv()
  const manager = new Manager({ kv, logSuccess })

  try {
    const { scopeName, generatorName, version } = Generator.parseName(packageName)

    const generator = Generator.fromName({ scopeName, generatorName, version: version ?? '0.0.1' })

    const denoJson = await DenoJson.open(manager)
    const stackJson = await StackJson.open(manager)

    generator.add({ denoJson, stackJson, generatorType: type })
  } catch (error) {
    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to add generator')
  }
}
