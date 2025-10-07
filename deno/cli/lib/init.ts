import { Command } from '@cliffy/command'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'

type InitArgs = {
  projectName: string
  skmtcRoot: SkmtcRoot
  generators: string[]
  basePath: string
}

type CreateProjectFolderOptions = {
  logSuccess?: boolean
}

export const toInitCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description('Initialize a new project in current directory')
    .arguments('<name:string> <generators:string[]> <basePath:string>')
    .action((_options, name, generators, basePath) => {
      return init({ projectName: name, skmtcRoot, generators, basePath }, { logSuccess: false })
    })

  return command
}

export const init = async (
  { projectName, skmtcRoot, generators, basePath }: InitArgs,
  { logSuccess }: CreateProjectFolderOptions
) => {
  try {
    const denoProject = await skmtcRoot.createDenoProject(projectName)
  } catch (error) {
    console.error(error)
    skmtcRoot.manager.fail('Failed to create deno project')
    return
  }

  const project = await skmtcRoot.createProject({ name: projectName, basePath, generators })

  if (logSuccess) {
    console.log('Created new project folder')
  }
}
