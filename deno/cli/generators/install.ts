import { Command } from '@cliffy/command'
import { Checkbox, Input, Select } from '@cliffy/prompt'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'
import { availableGenerators } from '../available-generators.ts'
import { isGeneratorName } from '@skmtc/core'

export const description = 'Install generator'

export const toInstallCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .arguments('<project:string> [generator:string]')
    .action((_options, projectName, generator) => {
      return toProject({ skmtcRoot, projectName, generator })
    })

  return command
}

export const toInstallPrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(project => project.name === projectName)

  const imports = project?.rootDenoJson.contents.imports ?? {}

  invariant(project, 'Project not found')

  const generators: string[] = await Checkbox.prompt({
    message: 'Select generator to install',
    options: availableGenerators
      .filter(item => !imports[item.name])
      .map(({ name }) => `jsr:${name}`)
  })

  await Promise.all(
    generators.map(async generator => {
      await project.installGenerator(
        { moduleName: generator },
        { logSuccess: `Generator "${generator}" is installed` }
      )
    })
  )
}

type ToProjectArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string | undefined
  generator: string | undefined
}

const toProject = async ({ skmtcRoot, projectName, generator }: ToProjectArgs) => {
  if (projectName && generator) {
    return skmtcRoot.projects
      .find(({ name }) => name === projectName)
      ?.installGenerator({ moduleName: generator })
  }

  const hasProjects = skmtcRoot.projects.length > 0

  if (projectName && !generator && isGeneratorName(projectName)) {
    if (!hasProjects) {
      return createProject({ skmtcRoot, generator: projectName })
    }

    const next = await Select.prompt({
      message: 'Select project to install generator to',
      options: [
        {
          name: 'Create new project',
          value: 'new'
        },
        {
          name: 'Select existing project',
          value: 'existing'
        }
      ]
    })

    if (next === 'new') {
      return createProject({ skmtcRoot, generator: projectName })
    }

    return useExistingProject({ skmtcRoot, generator: projectName })
  }
}

type CreateProjectArgs = {
  skmtcRoot: SkmtcRoot
  generator: string
}

const createProject = async ({ skmtcRoot, generator }: CreateProjectArgs) => {
  const name = await Input.prompt(
    "Let's create a new Skmtc project. What would you like to call it?"
  )

  const project = await skmtcRoot.createProject({ name, basePath: './', generators: [] })

  return project.installGenerator({ moduleName: generator })
}

type UseExistingProjectArgs = {
  skmtcRoot: SkmtcRoot
  generator: string
}

const useExistingProject = async ({ skmtcRoot, generator }: UseExistingProjectArgs) => {
  const newProjectName = await Select.prompt({
    message: 'Select project to deploy generators to',
    options: skmtcRoot.projects.map(({ name }) => ({
      name,
      value: name
    }))
  })

  const project = skmtcRoot.projects.find(({ name }) => name === newProjectName)

  invariant(project, 'Project not found')

  return project.installGenerator({ moduleName: generator })
}
