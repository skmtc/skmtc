import type { SchemaFile } from './schema-file.ts'
import { ClientJson } from './client-json.ts'
import { join } from '@std/path/join'
import type { Manager } from './manager.ts'
import { PrettierJson } from './prettier-json.ts'
import type { ProjectKey } from './project.ts'
import { toRemoteProjectPath } from './to-remote-project-path.ts'

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

  async ensureSchemaFile() {
    await this.schemaFile.promptOrFail(this)
  }

  toProjectKey() {
    return `@${this.accountName}/${this.name}`
  }

  toManifestPath() {
    return join('.skmtc', `@${this.accountName}`, this.name, '.settings', 'manifest.json')
  }

  async ensureDeployment(): Promise<boolean> {
    console.log('TODO: Implement remote project deployment check')

    return await Promise.resolve(true)
  }
}
