import type { SchemaFile } from '@/lib/schema-file.ts'
import { ClientJson } from '@/lib/client-json.ts'
import { join } from '@std/path/join'
import type { Manager } from '@/lib/manager.ts'
import { PrettierJson } from '@/lib/prettier-json.ts'
import type { ProjectKey } from '@/lib/project.ts'
import { toRemoteProjectPath } from '@/lib/to-remote-project-path.ts'
import { toRootPath } from '@/lib/to-root-path.ts'

type ConstructorArgs = {
  accountName: string
  name: string
  schemaFile: SchemaFile
  clientJson: ClientJson
  prettierJson: PrettierJson | null
  manager: Manager
}

type FromKeyArgs = {
  projectKey: ProjectKey
  schemaFile: SchemaFile
  prettierPath?: string
  manager: Manager
}

export class RemoteProject {
  accountName: string
  name: string
  schemaFile: SchemaFile
  clientJson: ClientJson
  prettierJson: PrettierJson | null
  manager: Manager
  private constructor({
    accountName,
    name,
    schemaFile,
    prettierJson,
    clientJson,
    manager
  }: ConstructorArgs) {
    this.accountName = accountName
    this.name = name
    this.schemaFile = schemaFile

    this.clientJson = clientJson
    this.prettierJson = prettierJson
    this.manager = manager
  }

  static async fromKey({ projectKey, schemaFile, prettierPath, manager }: FromKeyArgs) {
    const [accountName, name] = projectKey.split('/')

    const prettierJson = prettierPath ? await PrettierJson.openFromPath(prettierPath) : null

    const scrubbedAccountName = accountName.replace(/^@/, '')

    const clientJson = await ClientJson.open({
      path: ClientJson.toPath({ projectPath: toRemoteProjectPath(projectKey) }),
      manager
    })

    return new RemoteProject({
      accountName: scrubbedAccountName,
      name,
      schemaFile,
      prettierJson,
      clientJson,
      manager
    })
  }

  toProjectKey() {
    return `@${this.accountName}/${this.name}`
  }

  toManifestPath() {
    return join(toRootPath(), `@${this.accountName}`, this.name, '.settings', 'manifest.json')
  }
}
