import { Command, type StringType } from '@cliffy/command'
import { join } from '@std/path'
import { writeFile } from './lib/file.ts'
import { Input } from '@cliffy/prompt'
import { toNameSuggest } from './lib/to-name-suggest.ts'
import { toRootPath } from './lib/to-root-path.ts'
import { StackJson } from './lib/stack-json.ts'

type CreateProjectFolderOptions = {
  logSuccess?: boolean
}

export const init = async (name: string, { logSuccess }: CreateProjectFolderOptions) => {
  const rootPath = toRootPath()

  const stackJson = StackJson.create(name)

  await stackJson.write()

  await writeFile({
    content: prettierConfig,
    resolvedPath: join(rootPath, 'prettier.json')
  })

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

const prettierConfig: string = `{
  "tabWidth": 2,
  "useTabs": false,
  "semi": false,
  "singleQuote": true,
  "bracketSpacing": true
}
`
