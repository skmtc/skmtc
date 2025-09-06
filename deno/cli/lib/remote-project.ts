import invariant from 'tiny-invariant'
import type { SchemaFile } from './schema-file.ts'
import type { ClientJson } from './client-json.ts'
import { join } from '@std/path/join'
import type { Manager } from './manager.ts'
import type { PrettierJson } from './prettier-json.ts'

type ConstructorArgs = {
  accountName: string
  projectName: string
  schemaFile: SchemaFile
  manager: Manager
}

type FromKeyArgs = {
  projectKey: string
  schemaFile: SchemaFile
  manager: Manager
}

export class RemoteProject {
  accountName: string
  projectName: string
  schemaFile: SchemaFile
  clientJson: ClientJson | null
  prettierJson: PrettierJson | null
  manager: Manager
  constructor({ accountName, projectName, schemaFile, manager }: ConstructorArgs) {
    this.accountName = accountName
    this.projectName = projectName
    this.schemaFile = schemaFile

    this.clientJson = null
    this.prettierJson = null
    this.manager = manager
  }

  static fromKey({ projectKey, schemaFile, manager }: FromKeyArgs) {
    const [accountName, projectName] = projectKey.split('/')

    invariant(accountName.startsWith('@'), 'Account name must start with @')

    invariant(accountName, 'Account name not found')
    invariant(projectName, 'Project name not found')

    return new RemoteProject({ accountName, projectName, schemaFile, manager })
  }

  ensureSchemaFile() {
    if (!this.schemaFile) {
      throw new Error(`Project does not have a schema file.`)
    }
  }

  toProjectKey() {
    return `${this.accountName}/${this.projectName}`
  }

  toManifestPath() {
    return join('.skmtc', this.accountName, this.projectName, '.settings', 'manifest.json')
  }

  async ensureDeployment(): Promise<boolean> {
    console.log('TODO: Implement remote project deployment check')

    return await Promise.resolve(true)
  }
}
