import { Command, type StringType } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { GENERATORS } from '../lib/constants.ts'
import { Generator } from '../lib/generator.ts'
import { DenoJson } from '../lib/deno-json.ts'
import { StackJson } from '../lib/stack-json.ts'
import invariant from 'tiny-invariant'
import { Jsr } from '../lib/jsr.ts'
import { Manager } from '../lib/manager.ts'
import * as Sentry from 'npm:@sentry/deno'

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
    .action((_options, generator) => install(generator))

  return command
}

export const toInstallPrompt = async () => {
  const generator: string = await Input.prompt({
    message: 'Select generator to install',
    list: true,
    suggestions: GENERATORS
  })

  await install(generator, { logSuccess: `Generator "${generator}" is installed` })
}

type InstallOptions = {
  logSuccess?: string
}

const install = async (packageName: string, { logSuccess }: InstallOptions = {}) => {
  const kv = await Deno.openKv()
  const manager = new Manager({ kv, logSuccess })

  try {
    const { scheme, scopeName, generatorName, version } = Generator.parseName(packageName)

    invariant(scheme === 'jsr', 'Only JSR registry generators are supported')

    const generator = Generator.fromName({
      scopeName,
      generatorName,
      version: version ?? (await Jsr.getLatestMeta({ scopeName, generatorName })).latest
    })

    const denoJson = await DenoJson.open(manager)
    const stackJson = await StackJson.open(manager)

    generator.install({ denoJson, stackJson })

    await manager.success()
  } catch (error) {
    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to install generator')
  }
}
