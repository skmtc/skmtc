import { Command } from '@cliffy/command'
import { downloadAndCreateSchema } from './downloads.ts'
import { ensureDirSync } from '@std/fs'
import { join } from '@std/path'
import { writeFile } from './file.ts'
import {
  HELLO_WORLD_SCHEMA_URL,
  HELLO_WORLD_SCHEMA_NAME,
  PETSTORE_SCHEMA_NAME,
  PETSTORE_SCHEMA_URL
} from './constants.ts'
import { Toggle } from '@cliffy/prompt'
import { match } from 'ts-pattern'

type CreateProjectFolderOptions = {
  logSuccess?: boolean
}

export const createProjectFolder = ({ logSuccess }: CreateProjectFolderOptions) => {
  ensureDirSync(join(Deno.cwd(), '.schematic'))

  writeFile({
    content: prettierConfig,
    resolvedPath: join(Deno.cwd(), '.schematic', 'prettier.json')
  })

  if (logSuccess) {
    console.log('Created new project folder')
  }
}

type CommandType = Command<
  void,
  void,
  {
    demo?: true | undefined
  },
  [],
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
    .option('-d, --demo', `Include demo 'petstore' schema`)
    .action(({ demo }) => {
      init({ includeDemo: demo ? 'petstore' : undefined }, { logSuccess: false })
    })

  return command
}

type InitArgs = {
  includeDemo: 'hello-world' | 'petstore' | undefined
}

type InitOptions = {
  logSuccess?: boolean
}

export const init = async ({ includeDemo }: InitArgs, options: InitOptions) => {
  createProjectFolder(options)

  return await match(includeDemo)
    .with('hello-world', async () => {
      return await downloadAndCreateSchema(
        {
          url: HELLO_WORLD_SCHEMA_URL,
          name: HELLO_WORLD_SCHEMA_NAME
        },
        options
      )
    })
    .with('petstore', async () => {
      return await downloadAndCreateSchema(
        {
          url: PETSTORE_SCHEMA_URL,
          name: PETSTORE_SCHEMA_NAME
        },
        options
      )
    })
    .otherwise(async () => {})
}

type ToInitPromptArgs = {
  includeDemo?: 'hello-world' | 'petstore' | undefined
}

export const toInitPrompt = async ({ includeDemo }: ToInitPromptArgs = {}) => {
  const includedDemo =
    (includeDemo ?? (await Toggle.prompt(`Include demo 'petstore' schema?`)))
      ? 'petstore'
      : undefined

  await init({ includeDemo: includedDemo }, { logSuccess: true })
}

const prettierConfig: string = `{
  "tabWidth": 2,
  "useTabs": false,
  "semi": false,
  "singleQuote": true,
  "trailingComma": "none",
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
`
