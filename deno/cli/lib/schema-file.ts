import { exists } from '@std/fs'
import { join } from '@std/path'
import { toProjectPath } from './to-project-path.ts'
import type { Manager } from './manager.ts'
import { writeFileSafeDir } from './file.ts'
import { toRootPath } from './to-root-path.ts'

type CreateArgs = {
  projectName: string
  fileType: 'json' | 'yaml'
}

type ToSchemaFileTypeArgs = {
  projectName: string
  useParent?: boolean
}

type ConstructorArgs = {
  projectName: string
  contents: string
  fileType: 'json' | 'yaml'
  useParent: boolean
}

type SchemaInfo = {
  fileType: 'json' | 'yaml'
  useParent: boolean
}

type ToPathArgs = {
  projectName: string
  fileType: 'json' | 'yaml'
  useParent: boolean
}

export class SchemaFile {
  #contents: string
  projectName: string
  fileType: 'json' | 'yaml'
  useParent: boolean
  #dirty: boolean

  private constructor({ projectName, contents, fileType, useParent }: ConstructorArgs) {
    this.projectName = projectName
    this.#contents = contents
    this.fileType = fileType
    this.useParent = useParent

    this.#dirty = false
  }

  static toPath({ projectName, fileType, useParent }: ToPathArgs) {
    const projectPath = useParent ? toRootPath() : toProjectPath(projectName)

    return join(projectPath, `openapi.${fileType}`)
  }

  toPath() {
    return SchemaFile.toPath({
      projectName: this.projectName,
      fileType: this.fileType,
      useParent: this.useParent
    })
  }

  get contents() {
    return this.#contents
  }

  set contents(contents: string) {
    this.#contents = contents

    if (!this.#dirty) {
      this.#dirty = true
    }
  }

  static async toSchemaFileInfo({
    projectName,
    useParent = false
  }: ToSchemaFileTypeArgs): Promise<SchemaInfo | undefined> {
    const jsonPath = SchemaFile.toPath({ projectName, fileType: 'json', useParent })

    const hasJson = await exists(jsonPath, { isFile: true })

    const yamlPath = SchemaFile.toPath({ projectName, fileType: 'yaml', useParent })

    const hasYaml = await exists(yamlPath, { isFile: true })

    if (hasJson && hasYaml) {
      throw new Error('Both JSON and YAML schema files found')
    }

    if (hasJson) {
      return { fileType: 'json', useParent }
    }

    if (hasYaml) {
      return { fileType: 'yaml', useParent }
    }

    if (!useParent) {
      return SchemaFile.toSchemaFileInfo({ projectName, useParent: true })
    }
  }

  static async open(projectName: string, manager: Manager): Promise<SchemaFile | null> {
    const fileInfo = await SchemaFile.toSchemaFileInfo({ projectName })

    if (!fileInfo) {
      return null
    }

    const contents = await Deno.readTextFile(SchemaFile.toPath({ projectName, ...fileInfo }))

    const schemaFile = new SchemaFile({ projectName, contents, ...fileInfo })

    manager.cleanupActions.push(async () => {
      if (schemaFile.#dirty) {
        await schemaFile.write()
      }
    })

    return schemaFile
  }

  async write() {
    const path = SchemaFile.toPath({
      projectName: this.projectName,
      fileType: this.fileType,
      useParent: this.useParent
    })

    await writeFileSafeDir(path, this.contents)
  }

  static create({ projectName, fileType }: CreateArgs) {
    return new SchemaFile({ projectName, contents: '', fileType, useParent: false })
  }
}
