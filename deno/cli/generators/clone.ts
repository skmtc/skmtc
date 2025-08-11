import { Command } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'
import { availableGenerators } from '../available-generators.ts'

export const description = 'Clone remote generator to local'

export const toCloneCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .example('Clone RTK Query generator from JSR registry', 'clone jsr:@skmtc/rtk-query')
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

  const generator: string = await Input.prompt({
    message: 'Select generator to clone',
    list: true,
    suggestions: availableGenerators.map(({ name }) => `jsr:${name}`)
  })

  await project.cloneGenerator(
    { packageName: generator, projectName },
    { logSuccess: `Generator "${generator}" is cloned` }
  )
}
