import { Command, type StringType } from '@cliffy/command'
import { ensureFile } from '@std/fs'
import { join } from '@std/path'
import { Input } from '@cliffy/prompt'
import { GENERATORS } from '../constants.ts'
import { toRootPath } from '../lib/to-root-path.ts'
import { Generator } from '../lib/generator.ts'
import { Jsr } from '../lib/jsr.ts'

type DownloadAndCreatePackageOptions = {
  logSuccess?: boolean
}

export const downloadAndCreatePackage = async (
  generator: Generator,
  { logSuccess }: DownloadAndCreatePackageOptions = {}
) => {
  const rootPath = toRootPath()

  const files = await Jsr.download(generator)

  const generatorPath = join(rootPath, generator.generatorName)

  Object.entries(files).forEach(async ([path, content]) => {
    const joinedPath = join(generatorPath, path)

    await ensureFile(joinedPath)

    await Deno.writeTextFile(joinedPath, content)
  })

  if (logSuccess) {
    console.log(`Cloned generator to "${generator.toPath()}"`)
  }
}

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

const clone = async (packageName: string, options: CloneOptions) => {
  const generator = await Generator.fromName(packageName)

  await downloadAndCreatePackage(generator, options)
}
