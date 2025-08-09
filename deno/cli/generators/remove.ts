import { Command } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'

export const description = 'Remove a generator from the stack'

export const toRemoveCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .example('Remove RTK Query generator from the stack', 'remove @skmtc/rtk-query')
    .arguments('<project:string> <generator:string>')
    .action((_options, project, generator) => {
      return skmtcRoot.projects
        .find(({ name }) => name === project)
        ?.removeGenerator({ packageName: generator })
    })

  return command
}

export const toRemovePrompt = async (skmtcRoot: SkmtcRoot) => {
  const projectName = await Input.prompt({
    message: 'Select project to remove generator from',
    list: true,
    suggestions: skmtcRoot.projects.map(({ name }) => name)
  })

  const project = skmtcRoot.projects.find(project => project.name === projectName)

  invariant(project, 'Project not found')

  const generator: string = await Input.prompt({
    message: 'Remove a generator from the stack',
    list: true,
    suggestions: project.generatorIds
  })

  await project.removeGenerator(
    { packageName: generator },
    { logSuccess: `Generator "${generator}" is created` }
  )
}
