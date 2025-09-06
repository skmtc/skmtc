import { exists } from '@std/fs/exists'
import { resolve } from '@std/path/resolve'
import { join } from '@std/path/join'
import { toProjectPath } from './to-project-path.ts'
import { toRootPath } from './to-root-path.ts'

type FileType = 'json' | 'yaml'

type CreateArgs = {
  projectName: string
  fileType: FileType
}

type ToSchemaFileTypeArgs = {
  projectName: string
  useParent?: boolean
}

type ConstructorArgs = {
  schemaSource: SchemaSource
  contents: string
  fileType: FileType
}

type SchemaInfo = {
  fileType: FileType
  useParent: boolean
}

type ToPathArgs = {
  projectName: string
  fileType: FileType
  useParent: boolean
}

type SchemaSource =
  | {
      type: 'local'
      path: string
    }
  | {
      type: 'remote'
      url: string
    }

export class SchemaFile {
  contents: string
  schemaSource: SchemaSource
  fileType: FileType

  private constructor({ schemaSource, contents, fileType }: ConstructorArgs) {
    this.schemaSource = schemaSource
    this.contents = contents
    this.fileType = fileType
  }

  static toPath({ projectName, fileType, useParent }: ToPathArgs) {
    const projectPath = useParent ? toRootPath() : toProjectPath(projectName)

    return join(projectPath, `openapi.${fileType}`)
  }

  toSource() {
    return this.schemaSource
  }

  static async findProjectSchema({
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
      return SchemaFile.findProjectSchema({ projectName, useParent: true })
    }
  }
  static async openFromProject(projectName: string): Promise<SchemaFile | null> {
    const fileInfo = await SchemaFile.findProjectSchema({ projectName })

    if (!fileInfo) {
      return null
    }

    const contents = await Deno.readTextFile(SchemaFile.toPath({ projectName, ...fileInfo }))

    const path = SchemaFile.toPath({ projectName, ...fileInfo })

    const schemaFile = new SchemaFile({
      schemaSource: { type: 'local', path },
      contents,
      ...fileInfo
    })

    return schemaFile
  }

  static async openFromPath(sourceString: string): Promise<SchemaFile | null> {
    const schemaSource = toSchemaSource(sourceString)

    const { contents, fileType } = await SchemaFile.getFromSource(schemaSource)

    return new SchemaFile({ schemaSource, contents, fileType })
  }

  static async getFromSource(
    source: SchemaSource
  ): Promise<{ contents: string; fileType: FileType }> {
    if (source.type === 'remote') {
      const response = await fetch(source.url)

      const contents = await response.text()
      const url = new URL(source.url)

      const fileType = toFileType(url.pathname)

      return {
        contents,
        fileType
      }
    } else {
      const resolvedPath = resolve(source.path)
      const contents = await Deno.readTextFile(resolvedPath)
      const fileType = toFileType(source.path)

      return {
        contents,
        fileType
      }
    }
  }

  async refresh() {
    const { contents } = await SchemaFile.getFromSource(this.schemaSource)

    this.contents = contents
  }

  static create({ projectName, fileType }: CreateArgs) {
    const schemaPath = SchemaFile.toPath({ projectName, fileType, useParent: false })

    return new SchemaFile({
      schemaSource: { type: 'local', path: schemaPath },
      contents: '',
      fileType
    })
  }
}

const toFileType = (path: string) => {
  if (path.endsWith('.json')) {
    return 'json'
  }

  if (path.endsWith('.yaml')) {
    return 'yaml'
  }

  throw new Error(`File type is not JSON or YAML: ${path}`)
}

const toSchemaSource = (sourceString: string): SchemaSource => {
  if (sourceString.startsWith('http://') || sourceString.startsWith('https://')) {
    return { type: 'remote', url: sourceString }
  } else {
    return { type: 'local', path: sourceString }
  }
}
