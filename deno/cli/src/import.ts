import { Command, type StringType } from '@cliffy/command'
import { downloadAndCreateSchema } from './lib/downloads.ts'
import { Input } from '@cliffy/prompt'

type CommandType = Command<
  void,
  void,
  void,
  [StringType & string, StringType & string],
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

export const toImportCommand = (): CommandType => {
  const command = new Command()
    .description('Import ')
    .arguments('<name:string> <url:string>')
    .action((_options, name, url) => {
      add({ name, url }, { logSuccess: false })
    })

  return command
}

export const toAddPrompt = async () => {
  const name = await Input.prompt({
    message: 'Enter schema name'
  })

  const url = await Input.prompt({
    message: 'Enter schema url'
  })

  await add({ name, url }, { logSuccess: true })
}

type AddArgs = {
  name: string
  url: string
}

type AddOptions = {
  logSuccess?: boolean
}

const add = async ({ name, url }: AddArgs, options: AddOptions) => {
  await downloadAndCreateSchema({ name, url }, options)
}
