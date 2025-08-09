import { join } from '@std/path'
import * as v from 'valibot'
import { toProjectPath } from './to-project-path.ts'

type SetSchemaIdArgs = {
  schemaId: string
  path: string
}

type GetSchemaIdArgs = {
  path: string
}

export class KvState {
  kv: Deno.Kv

  constructor(kv: Deno.Kv) {
    this.kv = kv
  }

  getWorkspaceId = async (projectName: string) => {
    const projectPath = toProjectPath(projectName)

    const workspaceId = await this.kv.get(['workspaceId', projectPath])

    return v.parse(v.nullable(v.string()), workspaceId.value)
  }

  setWorkspaceId = async (projectName: string, workspaceId: string) => {
    const projectPath = toProjectPath(projectName)

    await this.kv.set(['workspaceId', projectPath], workspaceId)

    return workspaceId
  }

  setSchemaId = async ({ schemaId, path }: SetSchemaIdArgs) => {
    const joinedPath = join(Deno.cwd(), path)

    await this.kv.set(['schemaId', joinedPath], schemaId)

    return schemaId
  }

  getSchemaId = async ({ path }: GetSchemaIdArgs) => {
    const joinedPath = join(Deno.cwd(), path)

    const schemaId = await this.kv.get(['schemaId', joinedPath])

    return v.parse(v.nullable(v.string()), schemaId?.value)
  }

  clearSchemaId = async ({ path }: GetSchemaIdArgs) => {
    const joinedPath = join(Deno.cwd(), path)

    await this.kv.delete(['schemaId', joinedPath])
  }
}
