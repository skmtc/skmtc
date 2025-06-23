import type { FileSystemTree } from './types.ts'
import { join } from '@std/path'
import type { ApiClient } from './api-client.ts'

type PushArgs = {
  workspaceId: string
  path: string
}

export class BaseImage {
  apiClient: ApiClient

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient
  }

  static toFileTree(path: string): FileSystemTree {
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
            directory: BaseImage.toFileTree(fullPath)
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

  async push({ path, workspaceId }: PushArgs) {
    const fileTree = BaseImage.toFileTree(path)

    await this.apiClient.patchWorkspaceById({ workspaceId, baseImage: fileTree })
  }
}
