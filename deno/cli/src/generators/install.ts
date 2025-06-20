import { Command, type StringType } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { GENERATORS } from '../constants.ts'
import { Generator } from '../lib/generator.ts'
import { DenoJson } from '../lib/deno-json.ts'
import { StackJson } from '../lib/stack-json.ts'
import invariant from 'tiny-invariant'
import { Jsr } from '../lib/jsr.ts'

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

export const description = 'Install a generator'

export const toInstallCommand = (): CommandType => {
  const command = new Command()
    .description(description)
    .example('Install RTK Query generator from JSR registry', 'install jsr:@skmtc/rtk-query')
    .arguments('<generator:string>')
    .action((_options, generator) => install(generator, { logSuccess: false }))

  return command
}

export const toInstallPrompt = async () => {
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
  const { scheme, scopeName, generatorName, version } = Generator.parseName(packageName)

  invariant(scheme === 'jsr', 'Only JSR registry generators are supported')

  const generator = Generator.fromName({
    scopeName,
    generatorName,
    version: version ?? (await Jsr.getLatestMeta({ scopeName, generatorName })).latest
  })

  const denoJson = await DenoJson.open()
  const stackJson = await StackJson.open()

  generator.install({ denoJson, stackJson })

  await denoJson.write()
  await stackJson.write()

  if (options.logSuccess) {
    console.log(`Generator "${generator.toPackageName()}" is installed`)
  }
}
