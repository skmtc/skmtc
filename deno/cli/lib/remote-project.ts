import type { SchemaFile } from './schema-file.ts'
import type { ClientJson } from './client-json.ts'
import { join } from '@std/path/join'
import type { Manager } from './manager.ts'
import { PrettierJson } from './prettier-json.ts'
import type { ProjectKey } from './project.ts'

type ConstructorArgs = {
  accountName: string
  projectName: string
  schemaFile: SchemaFile
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
  projectName: string
  schemaFile: SchemaFile
  clientJson: ClientJson | null
  prettierJson: PrettierJson | null
  manager: Manager
  private constructor({
    accountName,
    projectName,
    schemaFile,
    prettierJson,
    manager
  }: ConstructorArgs) {
    this.accountName = accountName
    this.projectName = projectName
    this.schemaFile = schemaFile

    this.clientJson = null
    this.prettierJson = prettierJson
    this.manager = manager
  }

  static async fromKey({ projectKey, schemaFile, prettierPath, manager }: FromKeyArgs) {
    const [accountName, projectName] = projectKey.split('/')

    const prettierJson = prettierPath ? await PrettierJson.openFromPath(prettierPath) : null
    const scrubbedAccountName = accountName.replace(/^@/, '')

    return new RemoteProject({
      accountName: scrubbedAccountName,
      projectName,
      schemaFile,
      prettierJson,
      manager
    })
  }

  ensureSchemaFile() {
    if (!this.schemaFile) {
      throw new Error(`Project does not have a schema file.`)
    }
  }

  toProjectKey() {
    return `@${this.accountName}/${this.projectName}`
  }

  toManifestPath() {
    return join('.skmtc', `@${this.accountName}`, this.projectName, '.settings', 'manifest.json')
  }

  async ensureDeployment(): Promise<boolean> {
    console.log('TODO: Implement remote project deployment check')

    return await Promise.resolve(true)
  }
}
