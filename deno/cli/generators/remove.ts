import { Command, type StringType } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import type { Project } from '../lib/project.ts'

type CommandType = Command<
  void,
  void,
  void,
  [StringType & string],
  void,
  {
    number: number
    integer: number
    string: string
    boolean: boolean
    file: string
  },
  void,
  undefined
>

export const description = 'Remove a generator from the stack'

export const toRemoveCommand = (project: Project): CommandType => {
  const command = new Command()
    .description(description)
    .example('Remove RTK Query generator from the stack', 'remove @skmtc/rtk-query')
    .arguments('<generator:string>')
    .action((_options, generator) => project.removeGenerator({ packageName: generator }))

  return command
}

export const toRemovePrompt = async (project: Project) => {
  const generator: string = await Input.prompt({
    message: 'Remove a generator from the stack',
    list: true,
    suggestions: project.generatorIds
  })

  await project.removeGenerator(
    { packageName: generator },
    { logSuccess: `Generator "${generator}" is created` }
  )
}
