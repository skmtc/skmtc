import { Command } from '@cliffy/command'
import { Checkbox, Input, Select } from '@cliffy/prompt'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'
import { availableGenerators } from '../available-generators.ts'
import { isGeneratorName } from '@skmtc/core'
import type { Project } from '../lib/project.ts'
import { runPrompt } from '../prompt/run-prompt.ts'

export const description = 'Install generator'

export const toInstallCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .arguments('<project:string> [generator:string]')
    .action(async (_options, projectName, generatorName) => {
      const { project, moduleName, isNewProject } = await toProject({
        skmtcRoot,
        projectName,
        generatorName
      })

      const generator = await project.installGenerator({ moduleName })

      if (isNewProject && generator) {
        setTimeout(() => runPrompt(skmtcRoot, project.name), 0)
      }
    })

  return command
}

export const toInstallPrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.findProject(projectName)

  const imports = project?.rootDenoJson.contents.imports ?? {}

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
  generatorName: string | undefined
}

type ToProjectResult = {
  project: Project
  moduleName: string
  isNewProject: boolean
}

const toProject = async ({
  skmtcRoot,
  projectName,
  generatorName
}: ToProjectArgs): Promise<ToProjectResult> => {
  if (projectName && generatorName) {
    const project = skmtcRoot.projects.find(({ name }) => name === projectName)

    invariant(project, `Project "${projectName}" not found`)

    return { project, moduleName: generatorName, isNewProject: false }
  }

  const hasProjects = skmtcRoot.projects.length > 0

  if (projectName && !generatorName && isGeneratorName(projectName)) {
    if (!hasProjects) {
      return createProject({ skmtcRoot, generatorName: projectName })
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
      return createProject({ skmtcRoot, generatorName: projectName })
    }

    return useExistingProject({ skmtcRoot, generatorName: projectName })
  }

  throw new Error('Please provide a project name and generator name')
}

type CreateProjectArgs = {
  skmtcRoot: SkmtcRoot
  generatorName: string
}

const createProject = async ({
  skmtcRoot,
  generatorName
}: CreateProjectArgs): Promise<ToProjectResult> => {
  const name = await Input.prompt(
    "Let's create a new Skmtc project. What would you like to call it?"
  )

  const project = await skmtcRoot.createProject({
    name,
    basePath: './',
    generators: [generatorName]
  })

  await skmtcRoot.manager.success(`Project created in "${project.toPath()}"`)

  return { project, moduleName: generatorName, isNewProject: true }
}

type UseExistingProjectArgs = {
  skmtcRoot: SkmtcRoot
  generatorName: string
}

const useExistingProject = async ({
  skmtcRoot,
  generatorName
}: UseExistingProjectArgs): Promise<ToProjectResult> => {
  const newProjectName = await Select.prompt({
    message: 'Select project to deploy generators to',
    options: skmtcRoot.projects.map(({ name }) => ({
      name,
      value: name
    }))
  })

  const project = skmtcRoot.projects.find(({ name }) => name === newProjectName)

  invariant(project, `Project "${newProjectName}" not found`)

  return { project, moduleName: generatorName, isNewProject: false }
}
