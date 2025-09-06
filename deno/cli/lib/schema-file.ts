import { exists } from '@std/fs/exists'
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
  schemaPath: string
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

export class SchemaFile {
  contents: string
  schemaPath: string
  fileType: FileType

  private constructor({ schemaPath, contents, fileType }: ConstructorArgs) {
    this.schemaPath = schemaPath
    this.contents = contents
    this.fileType = fileType
  }

  static toPath({ projectName, fileType, useParent }: ToPathArgs) {
    const projectPath = useParent ? toRootPath() : toProjectPath(projectName)

    return join(projectPath, `openapi.${fileType}`)
  }

  toPath() {
    return this.schemaPath
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

    const schemaPath = SchemaFile.toPath({ projectName, ...fileInfo })

    const schemaFile = new SchemaFile({ schemaPath, contents, ...fileInfo })

    return schemaFile
  }

  static async openFromPath(schemaPath: string): Promise<SchemaFile | null> {
    const contents = await Deno.readTextFile(schemaPath)

    const fileType = toFileType(schemaPath)

    const schemaFile = new SchemaFile({ schemaPath, contents, fileType })

    return schemaFile
  }

  async refresh() {
    this.contents = await Deno.readTextFile(this.toPath())
  }

  static create({ projectName, fileType }: CreateArgs) {
    const schemaPath = SchemaFile.toPath({ projectName, fileType, useParent: false })

    return new SchemaFile({ schemaPath, contents: '', fileType })
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
