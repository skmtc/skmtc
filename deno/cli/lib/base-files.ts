import type { FileSystemTree } from './types.ts'
import { join } from '@std/path'
import type { ApiClient } from './api-client.ts'
import type { KvState } from './kv-state.ts'
import { IgnoreFile } from './ignore-file.ts'
import console from 'node:console'

type PushArgs = {
  kvState: KvState
  apiClient: ApiClient
}

type ToFileTreeArgs = {
  path: string
  ignoreFile: IgnoreFile
}

export class BaseFiles {
  path: string

  constructor(path: string) {
    this.path = path
  }

  static toFileTree({ path, ignoreFile }: ToFileTreeArgs): FileSystemTree {
    const tree: FileSystemTree = {}

    try {
      const entries = Deno.readDirSync(path)

      for (const entry of entries) {
        const fullPath = join(path, entry.name)

        if (ignoreFile.ignore.ignores(fullPath)) {
          continue
        }

        if (entry.isDirectory) {
          tree[entry.name] = {
            directory: BaseFiles.toFileTree({ path: fullPath, ignoreFile })
          }
        } else if (entry.isFile) {
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

  async push({ kvState, apiClient }: PushArgs) {
    const workspaceId = await kvState.getWorkspaceId()

    if (!workspaceId) {
      throw new Error('Workspace ID not found')
    }

    const ignoreFile = await IgnoreFile.fromFile(this.path)

    const fileTree = BaseFiles.toFileTree({ path: this.path, ignoreFile })

    await apiClient.patchWorkspaceById({ workspaceId, baseImage: fileTree })
  }
}
