import { toRootPath } from './to-root-path.ts'
import { join } from '@std/path'
import * as v from 'valibot'

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

  getWorkspaceId = async () => {
    const rootPath = toRootPath()

    const workspaceId = await this.kv.get(['workspaceId', rootPath])

    return v.parse(v.nullable(v.string()), workspaceId.value)
  }

  setWorkspaceId = async (workspaceId: string) => {
    const rootPath = toRootPath()

    await this.kv.set(['workspaceId', rootPath], workspaceId)

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
