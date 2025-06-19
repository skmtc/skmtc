import { Command, type StringType } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { GENERATORS } from '../constants.ts'
import { Generator } from '../lib/generator.ts'
import { DenoJson } from '../lib/deno-json.ts'
import { StackJson } from '../lib/stack-json.ts'
import { checkProjectName } from '@skmtc/core'

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

export const toCreateCommand = (): CommandType => {
  const command = new Command()
    .description('Create a new generator')
    .example('Create RTK Query generator from JSR registry', 'create jsr:@skmtc/rtk-query')
    .arguments('<generator:string>')
    .action((_options, generator) => create(generator, { logSuccess: false }))

  return command
}

export const toCreatePrompt = async () => {
  const generator: string = await Input.prompt({
    message: 'Create a new generator',
    validate: value => checkProjectName(value) ?? false
  })

  await create(generator, { logSuccess: true })
}

type CreateOptions = {
  logSuccess: boolean
}

// Should user be logged in to create a generator so we can use their account name as the scope name?
// Might be easier to let them pick any scope name since it is just a JSR value?
// Suggest scope name if they are logged in?
const create = async (packageName: string, { logSuccess }: CreateOptions) => {
  const generator = await Generator.fromName(packageName)

  const denoJson = await DenoJson.open()
  const stackJson = await StackJson.open()

  generator.install({ denoJson, stackJson })

  await denoJson.write()
  await stackJson.write()

  if (logSuccess) {
    console.log(`Generator "${generator.toPackageName()}" is created`)
  }
}
