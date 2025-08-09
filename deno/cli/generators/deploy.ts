import { Command } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'

export const description = 'Deploy generators to API Foundry'

export const toDeployCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string>')
    .action(async (_options, project) => {
      return await skmtcRoot.projects.find(({ name }) => name === project)?.deploy()
    })
}

export const toDeployPrompt = async (skmtcRoot: SkmtcRoot) => {
  const projectName = await Input.prompt({
    message: 'Select project to deploy generators to',
    list: true,
    suggestions: skmtcRoot.projects.map(({ name }) => name)
  })

  const project = skmtcRoot.projects.find(project => project.name === projectName)

  invariant(project, 'Project not found')

  await project.deploy({ logSuccess: 'Generators deployed' })
}
