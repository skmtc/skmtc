import { toRootPath } from './to-root-path.ts'
import { join } from '@std/path'

type SetSchemaIdArgs = {
  schemaId: string
  path: string
}

export class KvState {
  kv: Deno.Kv

  constructor(kv: Deno.Kv) {
    this.kv = kv
  }

  getWorkspaceId = async () => {
    const rootPath = toRootPath()

    const workspaceId = await this.kv.get([rootPath, 'workspaceId'])

    return workspaceId.value
  }

  setWorkspaceId = async (workspaceId: string) => {
    const rootPath = toRootPath()

    await this.kv.set([rootPath, 'workspaceId'], workspaceId)

    return workspaceId
  }

  setSchemaId = async ({ schemaId, path }: SetSchemaIdArgs) => {
    const rootPath = toRootPath()

    await this.kv.set([join(rootPath, path), 'schemaId'], schemaId)

    return schemaId
  }
}
