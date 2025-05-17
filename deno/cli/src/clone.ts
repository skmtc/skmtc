import { Command, type StringType } from '@cliffy/command'
import { ensureFile } from '@std/fs'
import { downloadPackage } from './downloads.ts'
import { join } from '@std/path'
import { Input } from '@cliffy/prompt'
import { PLUGINS } from './constants.ts'

type DownloadAndCreatePackageOptions = {
  logSuccess?: boolean
}

export const downloadAndCreatePackage = async (
  plugin: string,
  { logSuccess }: DownloadAndCreatePackageOptions = {}
) => {
  const entries = await downloadPackage(plugin)

  const pluginName = plugin.split('/').at(1)

  if (!pluginName) {
    throw new Error(`Invalid plugin name ${plugin}`)
  }

  const pluginPath = join('./generators', pluginName)

  entries.forEach(async ([path, content]) => {
    const joinedPath = join(pluginPath, path)
    await ensureFile(joinedPath)
    Deno.writeTextFileSync(joinedPath, content)
  })

  if (logSuccess) {
    console.log(`Cloned plugin to ${pluginName}`)
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
    .description('Clone a transformer or type-system from JSR registry for editing')
    .example('Clone RTK Query transformer from JSR registry', 'clone jsr:@skmtc/rtk-query')
    .arguments('<plugin:string>')
    .action((_options, plugin) => clone(plugin, { logSuccess: false }))

  return command
}

export const toClonePrompt = async () => {
  const plugin: string = await Input.prompt({
    message: 'Select plugin to clone',
    list: true,
    suggestions: PLUGINS
  })

  await clone(plugin, { logSuccess: true })
}

type CloneOptions = {
  logSuccess: boolean
}

const clone = async (plugin: string, options: CloneOptions) => {
  if (!plugin.startsWith('jsr:')) {
    throw new Error('Only JSR registry generators are supported')
  }

  const name = plugin.replace('jsr:', '')

  await downloadAndCreatePackage(name, options)
}
