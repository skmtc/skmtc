import { exists } from '@std/fs/exists'
import { resolve } from '@std/path/resolve'
import { join } from '@std/path/join'
import { toProjectPath } from '@/lib/to-project-path.ts'
import { toRootPath } from '@/lib/to-root-path.ts'
import invariant from 'tiny-invariant'
import type { FileType, SchemaSource } from '@/lib/types.ts'
import { toSchemaContents } from './to-schema-contents.ts'

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
      throw new Error(`Schema file at ${defaultFileInfo.path} is empty`)
    }

    return new SchemaFile({
      schemaSource: { type: 'local', path: defaultFileInfo.path },
      contents,
      fileType: defaultFileInfo.fileType
    })
  }

  static async openFromSource(schemaSourceString: string): Promise<SchemaFile> {
    const { contents, schemaSource, fileType } = await toSchemaContents(schemaSourceString)

    return new SchemaFile({ schemaSource, contents, fileType })
  }

  static async getFromSource(
    schemaSource: SchemaSource
  ): Promise<{ contents: string; fileType: FileType; schemaSource: SchemaSource }> {
    switch (schemaSource.type) {
      case 'remote': {
        const response = await fetch(schemaSource.url)
        const contents = await response.text()
        const url = new URL(schemaSource.url)
        // Prefer extension-based detection (cheap, deterministic). Fall
        // back to the response's Content-Type for endpoints whose URL
        // has no schema-bearing extension (e.g.
        // `https://example.com/schema` returning `application/graphql`).
        // Note: this still expects the *response body* to be a parseable
        // schema document — for live GraphQL HTTP endpoints that only
        // accept POSTed introspection queries, you currently need to
        // run introspection yourself and save the SDL to a file. A
        // future enhancement could detect a 405/missing-query response
        // and POST an introspection query automatically.
        const contentType = response.headers.get('content-type') ?? ''
        const fileType = toFileTypeFromPathOrContentType(url.pathname, contentType)

        return {
          contents,
          fileType,
          schemaSource
        }
      }
      case 'local': {
        const contents = await openPath(resolve(schemaSource.path))
        const fileType = toFileType(schemaSource.path)

        return {
          contents,
          fileType,
          schemaSource
        }
      }
    }
  }

  static create() {
    return new SchemaFile()
  }
}

const toFileType = (path: string): FileType => {
  if (path.endsWith('.json')) {
    return 'json'
  } else if (path.endsWith('.yaml') || path.endsWith('.yml')) {
    return 'yaml'
  } else if (path.endsWith('.graphql') || path.endsWith('.gql') || path.endsWith('.graphqls')) {
    return 'graphql'
  } else {
    throw new Error(
      `Schema file extension not recognized (expected .json, .yaml, .yml, .graphql, .gql, or .graphqls): ${path}`
    )
  }
}

/**
 * Like {@link toFileType} but consults `Content-Type` as a fallback when
 * the URL pathname doesn't end in a recognized extension. Used only for
 * remote sources, where servers can hint the format directly.
 *
 * Mappings:
 *   - `application/graphql`             → `graphql`
 *   - `application/json` / `text/json`  → `json`
 *   - `application/yaml` / `text/yaml` /
 *     `application/x-yaml` / `text/x-yaml` → `yaml`
 *
 * The header may include a `; charset=...` suffix; we strip it before
 * matching. If neither path nor content-type yields a recognized type,
 * we re-throw `toFileType`'s descriptive error so the user sees the
 * full list of supported formats.
 */
const toFileTypeFromPathOrContentType = (path: string, contentType: string): FileType => {
  try {
    return toFileType(path)
  } catch (pathError) {
    const mime = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? ''
    switch (mime) {
      case 'application/graphql':
        return 'graphql'
      case 'application/json':
      case 'text/json':
        return 'json'
      case 'application/yaml':
      case 'text/yaml':
      case 'application/x-yaml':
      case 'text/x-yaml':
        return 'yaml'
      default:
        throw new Error(
          `Could not determine schema format for remote source: URL pathname '${path}' has no recognized extension (.json, .yaml, .yml, .graphql, .gql, or .graphqls), and Content-Type '${contentType}' is not application/graphql, application/json, or application/yaml. ` +
            `For live GraphQL HTTP endpoints, run an introspection query yourself and save the SDL to a local file.`
        )
    }
  }
}

export const toSchemaSource = (source: string): SchemaSource => {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return { type: 'remote', url: source }
  } else {
    return { type: 'local', path: source }
  }
}

/**
 * Returns the conventional default path for a schema file of the given
 * type inside a project directory.
 *
 * - `json` / `yaml` → `openapi.<ext>` (legacy convention)
 * - `graphql`       → `schema.graphql`
 *
 * Used by {@link findSchemaFile} when discovering the schema file
 * implicitly (no source string supplied by the user).
 */
const projectToPath = ({ projectName, fileType, useParent }: ToPathArgs) => {
  const projectPath = useParent ? toRootPath() : toProjectPath(projectName)

  if (fileType === 'graphql') {
    return join(projectPath, 'schema.graphql')
  }
  return join(projectPath, `openapi.${fileType}`)
}

type FindSchemaFileArgs = {
  projectName: string
  useParent?: boolean
}

const openPath = async (path: string): Promise<string> => {
  const contents = await Deno.readTextFile(path)

  invariant(contents, `Schema file at "${path}" is empty`)

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
  // Probe each supported file type at its conventional location.
  // If multiple are present we surface a clear error rather than guess.
  const jsonPath = projectToPath({ projectName, fileType: 'json', useParent })
  const yamlPath = projectToPath({ projectName, fileType: 'yaml', useParent })
  const graphqlPath = projectToPath({ projectName, fileType: 'graphql', useParent })

  const [hasJson, hasYaml, hasGraphql] = await Promise.all([
    exists(jsonPath, { isFile: true }),
    exists(yamlPath, { isFile: true }),
    exists(graphqlPath, { isFile: true })
  ])

  const present = [hasJson, hasYaml, hasGraphql].filter(Boolean).length

  if (present > 1) {
    throw new Error(
      'Multiple schema files found at the default locations; expected exactly one of openapi.json, openapi.yaml, or schema.graphql'
    )
  }

  if (hasJson) {
    return { fileType: 'json', path: jsonPath }
  }
  if (hasYaml) {
    return { fileType: 'yaml', path: yamlPath }
  }
  if (hasGraphql) {
    return { fileType: 'graphql', path: graphqlPath }
  }

  if (!useParent) {
    return findSchemaFile({ projectName, useParent: true })
  }

  return null
}
