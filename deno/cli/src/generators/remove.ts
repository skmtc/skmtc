import { Command, type StringType } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
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

export const toRemoveCommand = (): CommandType => {
  const command = new Command()
    .description('Remove a generator from the stack')
    .example('Remove RTK Query generator from the stack', 'remove @skmtc/rtk-query')
    .arguments('<generator:string>')
    .action((_options, generator) => remove(generator, { logSuccess: false }))

  return command
}

export const toRemovePrompt = async () => {
  const stackJson = await StackJson.open()

  const generator: string = await Input.prompt({
    message: 'Remove a generator from the stack',
    list: true,
    suggestions: stackJson.contents.generators
  })

  await remove(generator, { logSuccess: true })
}

type RemoveOptions = {
  logSuccess: boolean
}

// Should user be logged in to create a generator so we can use their account name as the scope name?
// Might be easier to let them pick any scope name since it is just a JSR value?
// Suggest scope name if they are logged in?
const remove = async (packageName: string, { logSuccess }: RemoveOptions) => {
  const { scopeName, generatorName, version } = Generator.parseName(packageName)

  const generator = Generator.fromName({ scopeName, generatorName, version: version ?? '' })

  const denoJson = await DenoJson.open()
  const stackJson = await StackJson.open()

  generator.remove(denoJson, stackJson)

  await denoJson.write()
  await stackJson.write()

  if (logSuccess) {
    console.log(`Generator "${generator.toPackageName()}" is created`)
  }
}
