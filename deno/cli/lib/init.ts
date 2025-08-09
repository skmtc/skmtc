import { Command, type StringType } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { toNameSuggest } from './to-name-suggest.ts'
import { PrettierJson } from './prettier-json.ts'
import type { SkmtcRoot } from './skmtc-root.ts'

type InitArgs = {
  projectName: string
  skmtcRoot: SkmtcRoot
}

type CreateProjectFolderOptions = {
  logSuccess?: boolean
}

export const init = async (
  { projectName, skmtcRoot }: InitArgs,
  { logSuccess }: CreateProjectFolderOptions
) => {
  skmtcRoot.createProject(projectName, skmtcRoot.manager)

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

export const toInitCommand = (skmtcRoot: SkmtcRoot): CommandType => {
  const command = new Command()
    .description('Initialize a new project in current directory')
    .arguments('<name:string>')
    .action((_options, name) => {
      init({ projectName: name, skmtcRoot }, { logSuccess: false })
    })

  return command
}

export const toInitPrompt = async (skmtcRoot: SkmtcRoot) => {
  const suggestedName = await toNameSuggest()

  const name: string = await Input.prompt({
    message: `Choose a project name [${suggestedName}]`,
    suggestions: [suggestedName]
  })

  await init({ projectName: name, skmtcRoot }, { logSuccess: true })
}
