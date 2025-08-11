import { Command, EnumType } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { checkProjectName } from '@skmtc/core'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'

const generatorType = new EnumType(['operation', 'model'])

export const description = 'Add new local generator'

export const toAddCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .example('Add RTK Query generator from JSR registry', 'add jsr:@skmtc/rtk-query')
    .type('generator-type', generatorType)
    .arguments('<project:string> <generator:string> <type:generator-type>')
    .action((_options, project, generator, type) => {
      return skmtcRoot.projects
        .find(({ name }) => name === project)
        ?.addGenerator({ packageName: generator, type })
    })

  return command
}

export const toAddPrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(project => project.name === projectName)

  invariant(project, 'Project not found')

  const generator: string = await Input.prompt({
    message: 'Generator name',
    validate: value => checkProjectName(value) ?? false
  })

  const type = await Input.prompt({
    message: 'Select generator type',
    list: true,
    suggestions: generatorType.values
  })

  await project.addGenerator(
    { packageName: generator, type: type as 'operation' | 'model' },
    {
      logSuccess: `Generator "${generator}" is created`
    }
  )
}
