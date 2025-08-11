import { Command } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'

export const description = 'Remove generator'

export const toRemoveCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .arguments('<project:string> <generator:string>')
    .action((_options, project, generator) => {
      return skmtcRoot.projects
        .find(({ name }) => name === project)
        ?.removeGenerator({ packageName: generator })
    })

  return command
}

export const toRemovePrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(project => project.name === projectName)

  invariant(project, 'Project not found')

  const generator: string = await Input.prompt({
    message: 'Remove generator',
    list: true,
    suggestions: project.generatorIds
  })

  await project.removeGenerator(
    { packageName: generator },
    { logSuccess: `Generator "${generator}" is created` }
  )
}
