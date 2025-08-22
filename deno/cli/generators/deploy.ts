import { Command } from '@cliffy/command'
import { Confirm } from '@cliffy/prompt'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'
import { toNamePrompt } from '../lib/init.ts'

export const description = 'Deploy generators'

export const toDeployCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string>')
    .action(async (_options, projectName) => {
      const project = skmtcRoot.projects.find(({ name }) => name === projectName)

      invariant(project, 'Project not found')

      await project.deploy({ logSuccess: 'Generators deployed' })
    })
}

export const toDeployPrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(project => project.name === projectName)

  invariant(project, 'Project not found')

  const hasWriteAccess = await project.hasServerWriteAccess(skmtcRoot.apiClient)

  if (!hasWriteAccess) {
    const confirmed: boolean = await Confirm.prompt('Create a copy of project for editing?')

    if (!confirmed) {
      return
    }

    const name = await toNamePrompt({ skmtcRoot })

    await project.rename(name)

    return { projectName: name }
  }

  await project.deploy({ logSuccess: 'Generators deployed' })
}
