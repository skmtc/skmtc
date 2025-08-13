import { Command } from '@cliffy/command'
import { Checkbox } from '@cliffy/prompt'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'
import { Generator } from '../lib/generator.ts'

export const description = 'Clone generator from registry'

export const toCloneCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .arguments('<project:string> <generator:string>')
    .action((_options, project, generator) => {
      return skmtcRoot.projects
        .find(({ name }) => name === project)
        ?.cloneGenerator({ projectName: project, packageName: generator })
    })

  return command
}

export const toClonePrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(project => project.name === projectName)

  invariant(project, 'Project not found')

  const imports = project.rootDenoJson.contents.imports ?? {}

  const options = Object.values(imports).filter(item => {
    const { scheme } = Generator.parseName(item)

    return Boolean(scheme)
  })

  const generators = await Checkbox.prompt({
    message: 'Select generator to clone',
    options: options
  })

  await Promise.all(
    generators.map(async generator => {
      await project.cloneGenerator(
        { packageName: generator, projectName },
        { logSuccess: `Generator "${generator}" is cloned` }
      )
    })
  )
}
