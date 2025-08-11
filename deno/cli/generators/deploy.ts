import { Command } from '@cliffy/command'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'

export const description = 'Deploy generators'

export const toDeployCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string>')
    .action(async (_options, project) => {
      return await skmtcRoot.projects.find(({ name }) => name === project)?.deploy()
    })
}

export const toDeployPrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(project => project.name === projectName)

  invariant(project, 'Project not found')

  await project.deploy({ logSuccess: 'Generators deployed' })
}
