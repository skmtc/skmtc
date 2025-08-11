import { Command } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'
import { availableGenerators } from '../available-generators.ts'

export const description = 'Install remote generator'

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

export const toInstallPrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(project => project.name === projectName)

  invariant(project, 'Project not found')

  const generator: string = await Input.prompt({
    message: 'Select generator to install',
    list: true,
    suggestions: availableGenerators.map(({ name }) => `jsr:${name}`)
  })

  await project.installGenerator(
    { packageName: generator },
    { logSuccess: `Generator "${generator}" is installed` }
  )
}
