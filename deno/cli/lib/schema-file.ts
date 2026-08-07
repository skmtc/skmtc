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

/** How long a remote schema fetch may take before failing with a clear
 *  timeout error instead of hanging the command. */
const REMOTE_FETCH_TIMEOUT_MS = 30_000

export class SchemaFile {
  contents: string | null
  schemaSource: SchemaSource | null
  fileType: FileType | null

  private constructor(args?: ConstructorArgs) {
    this.schemaSource = args?.schemaSource || null
    this.contents = args?.contents || null
    this.fileType = args?.fileType || null
  }

  /**
   * Open a project's schema, TOLERATING an unreadable one.
   *
   * `Project.open` calls this, and `SkmtcRoot.open` opens EVERY project
   * in the root — so a throw here aborts the ~25 commands that touch the
   * root (`list`, `clean`, `remove`, `bundle`, `install`, `push`,
   * `publish`, `status`, …) plus the bare `skmtc` prompt, none of which
   * need the schema. One project pinned to a URL that now 404s would
   * take all of them down.
   *
   * So a source that cannot be read yields an EMPTY `SchemaFile` and a
   * stderr warning, exactly as `readManifestTolerant` does for a
   * malformed manifest. The commands that actually consume the schema
   * (`generate`, `dev`) reach it through `toSchemaContents` /
   * `toGenerateLocalArgs`, never through here, and still fail hard with
   * the full message.
   *
   * The warning goes to stderr so `--json` output on stdout stays clean.
   */
  static async openFromProject(
    projectName: string,
    source: string | undefined
  ): Promise<SchemaFile> {
    try {
      return await SchemaFile.openFromProjectStrict(projectName, source)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      console.error(
        `Warning: could not read the schema for project "${projectName}": ${reason}\n` +
          `  Commands that need the schema (\`skmtc generate ${projectName}\`) will report this; ` +
          `others continue without it.`
      )
      return new SchemaFile()
    }
  }

  private static async openFromProjectStrict(
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
        const response = await fetchRemote(schemaSource.url)

        if (!response.ok) {
          await response.body?.cancel()
          throw new Error(
            `Schema source ${schemaSource.url} returned ${response.status} ${response.statusText}`.trim()
          )
        }

        // `AbortSignal.timeout` covers the body read too, so a server that
        // sends headers promptly and then stalls rejects HERE, not at
        // `fetch`. Reading through the same wrapper keeps that failure
        // from escaping as a bare `TimeoutError` with no URL.
        const contents = await readRemoteBody(response, schemaSource.url)

        invariant(contents, `Schema fetched from "${schemaSource.url}" is empty`)

        // The final URL after redirects — a source that redirects to a
        // pinned/content-addressed form should be detected (and reported)
        // by where it landed, not where it started. A constructed Response
        // (tests, some proxies) has an empty `url`; fall back to the
        // requested one.
        const finalUrl = response.url === '' ? schemaSource.url : response.url
        const contentType = response.headers.get('content-type') ?? ''
        const fileType = toRemoteFileType({
          finalPath: new URL(finalUrl).pathname,
          contentType,
          requestedPath: new URL(schemaSource.url).pathname
        })

        return {
          contents,
          fileType,
          schemaSource: { type: 'remote', url: finalUrl }
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

/**
 * One phrasing for every way a remote fetch can fail, so the URL and —
 * for the 30s cap this adds — the reason are always in the message. A
 * timeout arrives as `TimeoutError`, whose own message ("The operation
 * was aborted due to timeout") names neither the source nor the limit.
 */
const toFetchFailure = (url: string, error: unknown): Error => {
  const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
  const reason = timedOut
    ? `timed out after ${REMOTE_FETCH_TIMEOUT_MS / 1000}s`
    : error instanceof Error
      ? error.message
      : String(error)

  return new Error(`Could not fetch schema from ${url}: ${reason}`)
}

const fetchRemote = async (url: string): Promise<Response> => {
  try {
    return await fetch(url, {
      signal: AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS),
      redirect: 'follow'
    })
  } catch (error) {
    throw toFetchFailure(url, error)
  }
}

const readRemoteBody = async (response: Response, url: string): Promise<string> => {
  try {
    return await response.text()
  } catch (error) {
    throw toFetchFailure(url, error)
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

/** `Content-Type` → `FileType`, or `null` when the header names nothing
 *  we can parse. The header may carry a `; charset=…` suffix. */
const toFileTypeFromContentType = (contentType: string): FileType | null => {
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
      return null
  }
}

const toFileTypeOrNull = (path: string): FileType | null => {
  try {
    return toFileType(path)
  } catch {
    return null
  }
}

type ToRemoteFileTypeArgs = {
  /** Pathname of the URL the response actually came from. */
  finalPath: string
  contentType: string
  /** Pathname of the URL the user pinned, before any redirect. */
  requestedPath: string
}

/**
 * Decide a remote source's format, in the order that is right most often:
 *
 *   1. the FINAL URL's extension — a redirect to `/spec.yaml` is the
 *      server telling you what it served;
 *   2. `Content-Type` — for endpoints with no schema-bearing extension
 *      (`https://example.com/schema` returning `application/graphql`);
 *   3. the REQUESTED URL's extension — `/openapi.json` redirecting to a
 *      presigned or content-addressed blob (`/blob/abc123`, often
 *      `application/octet-stream`) is a common shape, and the extension
 *      the user pinned is the last real evidence of intent.
 *
 * Detection expects the *response body* to be a parseable schema
 * document — for live GraphQL HTTP endpoints that only accept POSTed
 * introspection queries, run introspection yourself and save the SDL to
 * a file.
 */
const toRemoteFileType = ({
  finalPath,
  contentType,
  requestedPath
}: ToRemoteFileTypeArgs): FileType => {
  const detected =
    toFileTypeOrNull(finalPath) ??
    toFileTypeFromContentType(contentType) ??
    toFileTypeOrNull(requestedPath)

  if (detected) return detected

  const requestedNote =
    requestedPath === finalPath ? '' : ` (nor the requested '${requestedPath}')`

  throw new Error(
    `Could not determine schema format for remote source: URL pathname '${finalPath}'${requestedNote} has no recognized extension (.json, .yaml, .yml, .graphql, .gql, or .graphqls), and Content-Type '${contentType}' is not application/graphql, application/json, or application/yaml. ` +
      `For live GraphQL HTTP endpoints, run an introspection query yourself and save the SDL to a local file.`
  )
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
