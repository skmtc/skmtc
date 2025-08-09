import { Command } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { GENERATORS } from '../lib/constants.ts'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'

export const description = 'Install a generator'

export const toInstallCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .example('Install RTK Query generator from JSR registry', 'install jsr:@skmtc/rtk-query')
    .arguments('<project:string> <generator:string>')
    .action((_options, project, generator) => {
      return skmtcRoot.projects
        .find(({ name }) => name === project)
        ?.installGenerator({ packageName: generator })
    })

  return command
}

export const toInstallPrompt = async (skmtcRoot: SkmtcRoot) => {
  const projectName = await Input.prompt({
    message: 'Select project to install generator to',
    list: true,
    suggestions: skmtcRoot.projects.map(({ name }) => name)
  })

  const project = skmtcRoot.projects.find(project => project.name === projectName)

  invariant(project, 'Project not found')

  const generator: string = await Input.prompt({
    message: 'Select generator to install',
    list: true,
    suggestions: GENERATORS
  })

  await project.installGenerator(
    { packageName: generator },
    { logSuccess: `Generator "${generator}" is installed` }
  )
}
