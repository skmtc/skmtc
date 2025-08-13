import { exists } from '@std/fs'
import { join } from '@std/path'
import { toProjectPath } from './to-project-path.ts'
import type { Manager } from './manager.ts'
import { writeFileSafeDir } from './file.ts'

type CreateArgs = {
  projectName: string
  fileType: 'json' | 'yaml'
}

type ConstructorArgs = {
  projectName: string
  contents: string
  fileType: 'json' | 'yaml'
}

export class SchemaFile {
  contents: string
  projectName: string
  fileType: 'json' | 'yaml'

  private constructor({ projectName, contents, fileType }: ConstructorArgs) {
    this.projectName = projectName
    this.contents = contents
    this.fileType = fileType
  }

  static toPath(projectName: string, fileType: 'json' | 'yaml') {
    const projectPath = toProjectPath(projectName)

    return join(projectPath, `schema.${fileType}`)
  }

  static async toSchemaFileType(projectName: string): Promise<'json' | 'yaml' | undefined> {
    const hasJson = await exists(SchemaFile.toPath(projectName, 'json'), { isFile: true })
    const hasYaml = await exists(SchemaFile.toPath(projectName, 'yaml'), { isFile: true })

    if (hasJson && hasYaml) {
      throw new Error('Both JSON and YAML schema files found')
    }

    if (hasJson) {
      return 'json'
    }

    if (hasYaml) {
      return 'yaml'
    }
  }

  static async open(projectName: string, manager: Manager): Promise<SchemaFile> {
    const fileType = await SchemaFile.toSchemaFileType(projectName)

    if (!fileType) {
      throw new Error('Schema file not found')
    }

    const contents = await Deno.readTextFile(SchemaFile.toPath(projectName, fileType))

    const schemaFile = new SchemaFile({ projectName, contents, fileType })

    manager.cleanupActions.push(async () => await schemaFile.write())

    return schemaFile
  }

  async write() {
    const path = SchemaFile.toPath(this.projectName, this.fileType)

    await writeFileSafeDir(path, this.contents)
  }

  static create({ projectName, fileType }: CreateArgs) {
    return new SchemaFile({
      projectName,
      contents: '',
      fileType
    })
  }
}
