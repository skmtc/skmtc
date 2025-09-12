import { Command } from '@cliffy/command'
import { Checkbox, Input } from '../components/index.ts'
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
  try {
    const denoProject = await skmtcRoot.createDenoProject(projectName)

    console.log('Deno project created', denoProject)
  } catch (error) {
    console.error(error)
    skmtcRoot.manager.fail('Failed to create deno project')
    return
  }

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
  const name = await toNamePrompt({ skmtcRoot })

  const generators = await Checkbox.prompt({
    message: 'Select generators to use',

    options: availableGenerators.map(({ id }) => ({
      label: id,
      value: id
    }))
  })

  const basePath = await Input.prompt({
    message: 'Base path for generated files',
    default: './src'
  })

  await init({ projectName: name, skmtcRoot, generators, basePath }, { logSuccess: true })
}

type ToNamePromptArgs = {
  skmtcRoot: SkmtcRoot
}

export const toNamePrompt = async ({ skmtcRoot }: ToNamePromptArgs) => {
  const suggestedName = toNameSuggest()

  const name: string = await Input.prompt({
    message: `Choose a project name [${suggestedName}]`,
    suggestions: [suggestedName],
    validate: value => {
      if (value.length < 3) {
        return 'Project name must be at least 3 characters long'
      }

      const project = skmtcRoot.projects.find(project => project.name === value)

      if (project) {
        return `Project "${value}" already exists`
      }

      return true
    }
  })

  return name
}
