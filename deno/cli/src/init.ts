import { Command, type StringType } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { toNameSuggest } from './lib/to-name-suggest.ts'
import { StackJson } from './lib/stack-json.ts'
import { PrettierJson } from './lib/prettier-json.ts'

type CreateProjectFolderOptions = {
  logSuccess?: boolean
}

export const init = async (name: string, { logSuccess }: CreateProjectFolderOptions) => {
  const stackJson = StackJson.create(name)
  await stackJson.write()

  const prettierJson = PrettierJson.create()
  await prettierJson.write()

  if (logSuccess) {
    console.log('Created new project folder')
  }
}

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

export const toInitCommand = (): CommandType => {
  const command = new Command()
    .description('Initialize a new project in current directory')
    .arguments('<name:string>')
    .action((_options, name) => {
      init(name, { logSuccess: false })
    })

  return command
}

export const toInitPrompt = async () => {
  const suggestedName = await toNameSuggest()

  const name: string = await Input.prompt({
    message: `Choose a project name [${suggestedName}]`,
    suggestions: [suggestedName]
  })

  await init(name, { logSuccess: true })
}
