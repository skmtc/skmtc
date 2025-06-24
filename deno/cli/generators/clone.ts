import { Command, type StringType } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { GENERATORS } from '../lib/constants.ts'
import { Generator } from '../lib/generator.ts'
import { RootDenoJson } from '../lib/root-deno-json.ts'
import { StackJson } from '../lib/stack-json.ts'
import { Jsr } from '../lib/jsr.ts'
import invariant from 'tiny-invariant'
import { Manager } from '../lib/manager.ts'
import * as Sentry from '@sentry/deno'

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

export const description = 'Clone a generator for editing'

export const toCloneCommand = (): CommandType => {
  const command = new Command()
    .description(description)
    .example('Clone RTK Query generator from JSR registry', 'clone jsr:@skmtc/rtk-query')
    .arguments('<generator:string>')
    .action((_options, generator) => clone(generator))

  return command
}

export const toClonePrompt = async () => {
  const generator: string = await Input.prompt({
    message: 'Select generator to clone',
    list: true,
    suggestions: GENERATORS
  })

  await clone(generator, { logSuccess: `Generator "${generator}" is cloned` })
}

type CloneOptions = {
  logSuccess?: string
}

const clone = async (packageName: string, { logSuccess }: CloneOptions = {}) => {
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

    const denoJson = await RootDenoJson.open(manager)
    const stackJson = await StackJson.open(manager)

    await generator.clone({ denoJson, stackJson })
  } catch (error) {
    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to clone generator')
  }
}
