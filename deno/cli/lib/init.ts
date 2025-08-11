import { Command } from '@cliffy/command'
import { Input, List } from '@cliffy/prompt'
import { toNameSuggest } from './to-name-suggest.ts'
import type { SkmtcRoot } from './skmtc-root.ts'
import { availableGenerators } from '../available-generators.ts'

type InitArgs = {
  projectName: string
  skmtcRoot: SkmtcRoot
  generators: string[]
  basePath: string
}

type CreateProjectFolderOptions = {
  logSuccess?: boolean
}

export const init = async (
  { projectName, skmtcRoot, generators, basePath }: InitArgs,
  { logSuccess }: CreateProjectFolderOptions
) => {
  const project = await skmtcRoot.createProject({ name: projectName, basePath, generators })

  if (logSuccess) {
    console.log('Created new project folder')
  }
}

export const toInitCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description('Initialize a new project in current directory')
    .arguments('<name:string> <generators:string[]> <basePath:string>')
    .action((_options, name, generators, basePath) => {
      return init({ projectName: name, skmtcRoot, generators, basePath }, { logSuccess: false })
    })

  return command
}

export const toInitPrompt = async (skmtcRoot: SkmtcRoot) => {
  const suggestedName = toNameSuggest()

  const name: string = await Input.prompt({
    message: `Choose a project name [${suggestedName}]`,
    suggestions: [suggestedName]
  })

  const generators = await List.prompt({
    message: 'Select generators to use',

    list: true,
    suggestions: availableGenerators.map(({ id }) => id)
  })

  const basePath = await Input.prompt({
    message: 'Output path for generated files',
    default: './src'
  })

  await init({ projectName: name, skmtcRoot, generators, basePath }, { logSuccess: true })
}
