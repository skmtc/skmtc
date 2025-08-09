import { Command } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { GENERATORS } from '../lib/constants.ts'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'

export const description = 'Clone a generator for editing'

export const toCloneCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .example('Clone RTK Query generator from JSR registry', 'clone jsr:@skmtc/rtk-query')
    .arguments('<project:string> <generator:string>')
    .action((_options, project, generator) => {
      return skmtcRoot.projects
        .find(({ name }) => name === project)
        ?.cloneGenerator({ packageName: generator })
    })

  return command
}

export const toClonePrompt = async (skmtcRoot: SkmtcRoot) => {
  const projectName = await Input.prompt({
    message: 'Select project to clone generator to',
    list: true,
    suggestions: skmtcRoot.projects.map(({ name }) => name)
  })

  const project = skmtcRoot.projects.find(project => project.name === projectName)

  invariant(project, 'Project not found')

  const generator: string = await Input.prompt({
    message: 'Select generator to clone',
    list: true,
    suggestions: GENERATORS
  })

  await project.cloneGenerator(
    { packageName: generator },
    { logSuccess: `Generator "${generator}" is cloned` }
  )
}
