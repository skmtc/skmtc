import type { SchemaFile } from '@/lib/schema-file.ts'
import { ClientJson } from '@/lib/client-json.ts'
import { join } from '@std/path/join'
import type { Manager } from '@/lib/manager.ts'
import type { ProjectKey } from '@/lib/project.ts'
import { toRemoteProjectPath } from '@/lib/to-remote-project-path.ts'
import { toRootPath } from '@/lib/to-root-path.ts'

type ConstructorArgs = {
  accountName: string
  name: string
  schemaFile: SchemaFile
  clientJson: ClientJson
  manager: Manager
}

type FromKeyArgs = {
  projectKey: ProjectKey
  schemaFile: SchemaFile
  manager: Manager
}

export class RemoteProject {
  accountName: string
  name: string
  schemaFile: SchemaFile
  clientJson: ClientJson
  manager: Manager
  private constructor({
    accountName,
    name,
    schemaFile,
    clientJson,
    manager
  }: ConstructorArgs) {
    this.accountName = accountName
    this.name = name
    this.schemaFile = schemaFile

    this.clientJson = clientJson
    this.manager = manager
  }

  static async fromKey({ projectKey, schemaFile, manager }: FromKeyArgs) {
    const [accountName, name] = projectKey.split('/')

    const scrubbedAccountName = accountName.replace(/^@/, '')

    const clientJson = await ClientJson.open({
      path: ClientJson.toPath({ projectPath: toRemoteProjectPath(projectKey) }),
      manager
    })

    return new RemoteProject({
      accountName: scrubbedAccountName,
      name,
      schemaFile,
      clientJson,
      manager
    })
  }

  isRemote() {
    return true
  }

  toProjectKey() {
    return `@${this.accountName}/${this.name}`
  }

  toManifestPath() {
    return join(toRootPath(), `@${this.accountName}`, this.name, '.settings', 'manifest.json')
  }
}
