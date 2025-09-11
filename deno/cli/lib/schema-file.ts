import { exists } from '@std/fs/exists'
import { resolve } from '@std/path/resolve'
import { join } from '@std/path/join'
import { toProjectPath } from './to-project-path.ts'
import { toRootPath } from './to-root-path.ts'
import invariant from 'tiny-invariant'
import { match, P } from 'ts-pattern'
import { Input } from '@cliffy/prompt'
import type { Project } from './project.ts'
import type { RemoteProject } from './remote-project.ts'

type FileType = 'json' | 'yaml'

type ConstructorArgs = {
  schemaSource: SchemaSource
  contents: string
  fileType: FileType
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
  contents: string | null
  schemaSource: SchemaSource | null
  fileType: FileType | null

  private constructor(args?: ConstructorArgs) {
    this.schemaSource = args?.schemaSource || null
    this.contents = args?.contents || null
    this.fileType = args?.fileType || null
  }

  static async openFromProject(
    projectName: string,
    source: string | undefined
  ): Promise<SchemaFile> {
    if (source) {
      return await SchemaFile.openFromSource(source)
    }

    const defaultFileInfo = await findSchemaFile({ projectName })

    if (!defaultFileInfo) {
      return new SchemaFile()
    }

    const contents = await openPath(defaultFileInfo.path)

    if (!contents) {
      throw new Error(`OpenAPI schema file at ${defaultFileInfo.path} is empty`)
    }

    return new SchemaFile({
      schemaSource: { type: 'local', path: defaultFileInfo.path },
      contents,
      fileType: defaultFileInfo.fileType
    })
  }

  static async openFromSource(source: string): Promise<SchemaFile> {
    const schemaSource = toSchemaSource(source)

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
      const contents = await openPath(resolve(source.path))
      const fileType = toFileType(source.path)

      return {
        contents,
        fileType
      }
    }
  }

  async promptOrFail(project: Project | RemoteProject) {
    if (!this.schemaSource) {
      const source = await Input.prompt('Enter path or url of OpenAPI schema')
      const schemaSource = toSchemaSource(source)
      const { contents } = await SchemaFile.getFromSource(schemaSource)

      invariant(contents, `Failed to load OpenAPI schema from "${source}"`)

      project.clientJson.contents.source = source
      await project.clientJson.write()

      this.contents = contents
      this.schemaSource = schemaSource
      this.fileType = toFileType(source)
    }

    if (this.schemaSource?.type === 'local') {
      const { contents } = await SchemaFile.getFromSource(this.schemaSource)

      invariant(contents, `Failed to load OpenAPI schema from "${this.schemaSource.path}"`)

      this.contents = contents
    }
  }

  static create() {
    return new SchemaFile()
  }
}

const toFileType = (path: string): FileType => {
  return match(path)
    .returnType<FileType>()
    .with(P.string.endsWith('.json'), () => 'json')
    .with(P.string.endsWith('.yaml'), () => 'yaml')
    .with(P.string.endsWith('.yml'), () => 'yaml')
    .otherwise(() => {
      throw new Error(`File type is not JSON or YAML: ${path}`)
    })
}

const toSchemaSource = (source: string): SchemaSource => {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return { type: 'remote', url: source }
  } else {
    return { type: 'local', path: source }
  }
}

const projectToPath = ({ projectName, fileType, useParent }: ToPathArgs) => {
  const projectPath = useParent ? toRootPath() : toProjectPath(projectName)

  return join(projectPath, `openapi.${fileType}`)
}

type FindSchemaFileArgs = {
  projectName: string
  useParent?: boolean
}

const openPath = async (path: string): Promise<string> => {
  const contents = await Deno.readTextFile(path)

  invariant(contents, `OpenAPI schema file at "${path}" is empty`)

  return contents
}

type FindSchemaFileResult = {
  fileType: FileType
  path: string
} | null

const findSchemaFile = async ({
  projectName,
  useParent = false
}: FindSchemaFileArgs): Promise<FindSchemaFileResult | null> => {
  const jsonPath = projectToPath({ projectName, fileType: 'json', useParent })

  const hasJson = await exists(jsonPath, { isFile: true })

  const yamlPath = projectToPath({ projectName, fileType: 'yaml', useParent })

  const hasYaml = await exists(yamlPath, { isFile: true })

  if (hasJson && hasYaml) {
    throw new Error('Both JSON and YAML schema files found')
  }

  if (hasJson) {
    return { fileType: 'json', path: jsonPath }
  }

  if (hasYaml) {
    return { fileType: 'yaml', path: yamlPath }
  }

  if (!useParent) {
    return findSchemaFile({ projectName, useParent: true })
  }

  return null
}
