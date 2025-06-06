import { Command } from '@cliffy/command'
import { getWorkspaceById } from './get-workspace-by-id.ts'
import { Input } from '@cliffy/prompt'
import { getWorkspaceId } from '../workspaces/workspaces.ts'
import { join, resolve } from '@std/path'
import { patchWorkspaceById } from './patch-workspace-by-id.ts'

export interface FileSystemTree {
  [name: string]: DirectoryNode | FileNode
}

export interface DirectoryNode {
  directory: FileSystemTree
}

export interface FileNode {
  file: {
    contents: string | Uint8Array
  }
}

export const toFileTree = (path: string): FileSystemTree => {
  const tree: FileSystemTree = {}

  try {
    const entries = Deno.readDirSync(path)

    for (const entry of entries) {
      const fullPath = join(path, entry.name)

      if (entry.isDirectory) {
        if (['node_modules', 'build', '.yarn'].includes(entry.name)) {
          continue
        }

        tree[entry.name] = {
          directory: toFileTree(fullPath)
        }
      } else if (entry.isFile) {
        if (['.DS_Store', 'base-files.json'].includes(entry.name)) {
          continue
        }

        const contents = Deno.readTextFileSync(fullPath)
        tree[entry.name] = {
          file: {
            contents
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error reading path ${path}:`, error)
    throw error
  }

  return tree
}

export type FormFieldItem = {
  id: string
  accessorPath: string[]
  input: string
  label: string
  placeholder?: string
}

export type FormItem = {
  title: string
  fields: FormFieldItem[]
}

export type TableColumnItem = {
  id: string
  accessorPath: string[]
  formatter: string
  label: string
}

export type InputOptionConfigItem = {
  id: string
  accessorPath: string[]
  formatter: string
}

type OperationEnrichments = {
  columns: TableColumnItem[]
  form: FormItem
  optionLabel: InputOptionConfigItem
}

type MethodEnrichments = Record<string, OperationEnrichments>
type PathEnrichments = Record<string, MethodEnrichments>
export type GeneratorEnrichments = Record<string, PathEnrichments>

export const toBaseImagePullCommand = () => {
  return (
    new Command()
      .description('Push base image to deployed workspace')
      .arguments('[path]')
      // .option('-s, --settings <settings>', 'The settings to use')
      // .option('-p, --prettier [prettier]', 'The prettier config to use')
      .action(async (_args, path = './') => {
        const kv = await Deno.openKv()

        const workspaceId = await getWorkspaceId({ kv, path })

        if (!workspaceId || typeof workspaceId !== 'string') {
          console.log('No workspace ID found')
          return
        }

        const workspace = await getWorkspaceById({ kv, workspaceId })

        console.log('WORKSPACE', workspace)
      })
  )
}

export const toBaseImagePushCommand = () => {
  return (
    new Command()
      .description('Push base image to deployed workspace')
      .arguments('[path]')
      .option('-b, --base-image <baseImage>', 'Path to base image folder')
      // .option('-p, --prettier [prettier]', 'The prettier config to use')
      .action(async ({ baseImage = './' }, path = './') => {
        const kv = await Deno.openKv()

        const workspaceId = await getWorkspaceId({ kv, path })

        console.log('WORKSPACE ID', workspaceId)

        if (!workspaceId || typeof workspaceId !== 'string') {
          console.log('No workspace ID found')
          return
        }

        const pathToBaseImage = resolve(path, baseImage)

        const fileTree = toFileTree(pathToBaseImage)

        await patchWorkspaceById({ kv, workspaceId, baseImage: fileTree })
      })
  )
}

export const toBaseImagePushPrompt = async () => {
  const kv = await Deno.openKv()

  const path = await Input.prompt({
    message: 'Enter path to .codesquared folder'
  })

  const baseImage = await Input.prompt({
    message: 'Enter path to base image folder'
  })

  const workspaceId = await getWorkspaceId({ kv, path })

  if (!workspaceId || typeof workspaceId !== 'string') {
    console.log('No workspace ID found')
    return
  }

  const pathToBaseImage = resolve(path, baseImage)

  const fileTree = toFileTree(pathToBaseImage)

  console.log('FILE TREE', fileTree)
}

export const toBaseImagePullPrompt = async () => {
  const kv = await Deno.openKv()

  const path = await Input.prompt({
    message: 'Enter path to .codesquared folder'
  })

  const workspaceId = await getWorkspaceId({ kv, path })

  if (!workspaceId || typeof workspaceId !== 'string') {
    console.log('No workspace ID found')
    return
  }

  const workspace = await getWorkspaceById({ kv, workspaceId })

  console.log('WORKSPACE', workspace)
}
