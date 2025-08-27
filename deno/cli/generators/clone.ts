import { Command } from '@cliffy/command'
import { Checkbox } from '@cliffy/prompt'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'
import { parseModuleName } from '@skmtc/core'

export const description = 'Clone generator'

export const toCloneCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .arguments('<project:string> <generator:string>')
    .action((_options, project, generator) => {
      return skmtcRoot.projects
        .find(({ name }) => name === project)
        ?.cloneGenerator({ projectName: project, moduleName: generator })
    })

  return command
}

export const toClonePrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(project => project.name === projectName)

  invariant(project, 'Project not found')

  const options = Object.entries(project.rootDenoJson.contents.imports ?? {})
    .filter(([_, source]) => {
      const { scheme, packageName } = parseModuleName(source)

      return Boolean(scheme) && packageName.startsWith('gen-')
    })
    .map(([moduleName]) => moduleName)

  const generators = await Checkbox.prompt({
    message: 'Select generator to clone',
    options: options
  })

  await Promise.all(
    generators.map(async generator => {
      await project.cloneGenerator(
        { moduleName: generator, projectName },
        { logSuccess: `Generator "${generator}" is cloned` }
      )
    })
  )
}
