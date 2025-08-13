import { Command, EnumType } from '@cliffy/command'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import console from 'node:console'

const generatorType = new EnumType(['operation', 'model'])

export const description = 'List generators'

export const toListCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .type('generator-type', generatorType)
    .arguments('<project:string>')
    .action((_options, projectName) => {
      const project = skmtcRoot.projects.find(({ name }) => name === projectName)

      project?.toGeneratorIds().forEach(generatorId => {
        console.log(generatorId)
      })
    })

  return command
}

export const toListPrompt = (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(project => project.name === projectName)

  project?.toGeneratorIds().forEach(generatorId => {
    console.log(generatorId)
  })
}
