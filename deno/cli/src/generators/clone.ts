import { Command, type StringType } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { GENERATORS } from '../constants.ts'
import { Generator } from '../lib/generator.ts'
import { DenoJson } from '../lib/deno-json.ts'
import { StackJson } from '../lib/stack-json.ts'
import { Jsr } from '../lib/jsr.ts'
import invariant from 'tiny-invariant'

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

export const toCloneCommand = (): CommandType => {
  const command = new Command()
    .description('Clone a generator for editing')
    .example('Clone RTK Query generator from JSR registry', 'clone jsr:@skmtc/rtk-query')
    .arguments('<generator:string>')
    .action((_options, generator) => clone(generator, { logSuccess: false }))

  return command
}

export const toClonePrompt = async () => {
  const generator: string = await Input.prompt({
    message: 'Select generator to clone',
    list: true,
    suggestions: GENERATORS
  })

  await clone(generator, { logSuccess: true })
}

type CloneOptions = {
  logSuccess: boolean
}

const clone = async (packageName: string, { logSuccess }: CloneOptions) => {
  const { scheme, scopeName, generatorName, version } = Generator.parseName(packageName)

  invariant(scheme === 'jsr', 'Only JSR registry generators are supported')

  const generator = Generator.fromName({
    scopeName,
    generatorName,
    version: version ?? (await Jsr.getLatestMeta({ scopeName, generatorName })).latest
  })

  const denoJson = await DenoJson.open()
  const stackJson = await StackJson.open()

  await generator.clone({ denoJson, stackJson })

  await denoJson.write()
  await stackJson.write()

  if (logSuccess) {
    console.log(`Generator "${generator.toPackageName()}" is cloned`)
  }
}
