import { join } from '@std/path/join'
import type { ApiClient } from './api-client.ts'
import { IgnoreFile } from './ignore-file.ts'
import { getApiWorkspacesWorkspaceName } from '../services/getApiWorkspacesWorkspaceName.generated.ts'
import { patchApiWorkspacesWorkspaceId } from '../services/patchApiWorkspacesWorkspaceId.generated.ts'

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
    const workspace = await getApiWorkspacesWorkspaceName({
      workspaceName: projectName,
      supabase: apiClient.manager.auth.supabase
    })

    const workspaceId = workspace.id

    if (!workspaceId) {
      throw new Error('Workspace ID not found')
    }

    const ignoreFile = await IgnoreFile.fromFile(this.path)

    const baseFiles = BaseFiles.toBaseFiles({ path: this.path, ignoreFile })

    await patchApiWorkspacesWorkspaceId({
      workspaceId,
      supabase: apiClient.manager.auth.supabase,
      body: { baseFiles }
    })

    await apiClient.uploadBaseFiles({ workspaceId, baseFiles })
  }
}
