import { Command } from '@cliffy/command'
import { Checkbox } from '@cliffy/prompt'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'
import { availableGenerators } from '../available-generators.ts'

export const description = 'Install generator'

export const toInstallCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .arguments('<project:string> <generator:string>')
    .action((_options, project, generator) => {
      return skmtcRoot.projects
        .find(({ name }) => name === project)
        ?.installGenerator({ moduleName: generator })
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
