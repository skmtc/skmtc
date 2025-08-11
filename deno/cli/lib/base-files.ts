import { join } from '@std/path'
import type { ApiClient } from './api-client.ts'
import { IgnoreFile } from './ignore-file.ts'

type PushArgs = {
  projectName: string
  apiClient: ApiClient
}

type ToFileTreeArgs = {
  path: string
  output?: Record<string, string>
  ignoreFile: IgnoreFile
}

export class BaseFiles {
  path: string

  constructor(path: string) {
    this.path = path
  }

  static toBaseFiles({ path, ignoreFile, output = {} }: ToFileTreeArgs): Record<string, string> {
    try {
      const entries = Deno.readDirSync(path)

      for (const entry of entries) {
        const fullPath = join(path, entry.name)

        if (ignoreFile.ignore.ignores(fullPath)) {
          continue
        }

        if (entry.isDirectory) {
          BaseFiles.toBaseFiles({ path: fullPath, ignoreFile, output })
        } else if (entry.isFile) {
          output[fullPath] = Deno.readTextFileSync(fullPath)
        }
      }
    } catch (error) {
      console.error(`Error reading path ${path}:`, error)
      throw error
    }

    return output
  }

  async push({ projectName, apiClient }: PushArgs) {
    const workspace = await apiClient.getWorkspaceByName(projectName)

    const workspaceId = workspace.id

    if (!workspaceId) {
      throw new Error('Workspace ID not found')
    }

    const ignoreFile = await IgnoreFile.fromFile(this.path)

    const baseFiles = BaseFiles.toBaseFiles({ path: this.path, ignoreFile })

    await apiClient.patchWorkspaceById({ workspaceId, baseFiles })

    await apiClient.uploadBaseFiles({ workspaceId, baseFiles })
  }
}
