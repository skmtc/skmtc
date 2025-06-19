import { Command, type StringType } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { GENERATORS } from '../constants.ts'
import { Generator } from '../lib/generator.ts'

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

export const toInstallCommand = (): CommandType => {
  const command = new Command()
    .description('Install a generator')
    .example('Install RTK Query generator from JSR registry', 'install jsr:@skmtc/rtk-query')
    .arguments('<generator:string>')
    .action((_options, generator) => install(generator, { logSuccess: false }))

  return command
}

export const toImportPrompt = async () => {
  const generator: string = await Input.prompt({
    message: 'Select generator to install',
    list: true,
    suggestions: GENERATORS
  })

  await install(generator, { logSuccess: true })
}

type InstallOptions = {
  logSuccess: boolean
}

const install = async (packageName: string, options: InstallOptions) => {
  const generator = await Generator.fromName(packageName)

  await downloadAndCreatePackage(name, options)
}
