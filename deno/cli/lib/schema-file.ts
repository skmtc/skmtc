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

/**
 * How long a remote schema fetch may go WITHOUT RECEIVING DATA before
 * failing with a clear timeout error instead of hanging the command.
 *
 * Idle, not total: the budget resets on every chunk that arrives, so a
 * large spec on a slow-but-progressing link still completes, while a
 * server that accepts the connection and then stalls fails inside the
 * window. A total cap would regress the "40MB spec over a congested VPN"
 * case that worked before any timeout existed.
 */
const REMOTE_FETCH_IDLE_TIMEOUT_MS = 30_000

/**
 * A project whose schema configuration is AMBIGUOUS or MALFORMED, as
 * opposed to one whose source could not be reached.
 *
 * The distinction is what {@link SchemaFile.openFromProject} tolerates.
 * An unreachable source is environmental — the network is down, a pinned
 * URL now 404s — and must not take down the commands that never needed
 * the schema. Two schema files sitting in the same directory is a
 * deterministic mistake that no command can work around, so it keeps
 * failing hard from every command, as it did before the tolerant wrapper.
 */
export class SchemaConfigError extends Error {
  override readonly name = 'SchemaConfigError'
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
   * A {@link SchemaConfigError} is NOT tolerated — the project is
   * misconfigured rather than unreachable, and a warning line is easy to
   * miss (invisible in `--json` runs, where agents read stdout).
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
      if (error instanceof SchemaConfigError) {
        throw error
      }

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
        // One deadline for the whole exchange, reset by every chunk the
        // body read receives. `clear()` in `finally` so a fast success
        // does not leave a pending timer holding the event loop open.
        const timeout = toIdleTimeout(REMOTE_FETCH_IDLE_TIMEOUT_MS)

        try {
          const response = await fetchRemote(schemaSource.url, timeout.signal)

          if (!response.ok) {
            // Not awaited: cancelling an ERRORED stream rejects (a server
            // that sends 500 headers and then resets), and awaiting it here
            // would replace the status error with a bare stream error
            // naming neither the URL nor the status.
            void response.body?.cancel().catch(() => {})
            throw new Error(
              `Schema source ${schemaSource.url} returned ${response.status} ${response.statusText}`.trim()
            )
          }

          // The deadline covers the body read too, so a server that sends
          // headers promptly and then stalls rejects HERE, not at `fetch`.
          // Reading through the same wrapper keeps that failure from
          // escaping as a bare `TimeoutError` with no URL.
          const contents = await readRemoteBody({ response, url: schemaSource.url, timeout })

          // `.trim()`: a whitespace-only body is as empty as an absent one
          // — the shape a misconfigured proxy or a template that rendered
          // nothing returns — and would otherwise resurface downstream as
          // an opaque parse error.
          invariant(contents.trim(), `Schema fetched from "${schemaSource.url}" is empty`)

          // The final URL after redirects — a source that redirects to a
          // pinned/content-addressed form should be detected (and reported)
          // by where it landed, not where it started. A constructed Response
          // (tests, some proxies) has an empty `url`; fall back to the
          // requested one.
          const finalUrl = response.url === '' ? schemaSource.url : response.url
          const contentType = response.headers.get('content-type') ?? ''
          const fileType = toRemoteFileType({
            finalUrl,
            contentType,
            requestedUrl: schemaSource.url
          })

          return {
            contents,
            fileType,
            schemaSource: { type: 'remote', url: finalUrl }
          }
        } finally {
          timeout.clear()
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

type IdleTimeout = {
  /** Pass to `fetch`; aborts once the idle window elapses. */
  signal: AbortSignal
  /** Restart the window — call whenever bytes arrive. */
  touch: () => void
  /** Stop the timer. Always call, or it holds the event loop open. */
  clear: () => void
}

/**
 * An abort deadline that RESETS on progress.
 *
 * `AbortSignal.timeout` caps the whole exchange, which turns a slow but
 * healthy download into a failure. This aborts only when nothing has
 * arrived for `ms`, so the size of the schema stops mattering and only a
 * genuinely stalled connection trips it. The abort reason is a
 * `TimeoutError`, so {@link toFetchFailure} phrases it the same way for
 * the connect phase and the body read.
 */
const toIdleTimeout = (ms: number): IdleTimeout => {
  const controller = new AbortController()

  // Mutable because the point is to reschedule it on every chunk.
  let timer: ReturnType<typeof setTimeout> | undefined

  const clear = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  const touch = () => {
    clear()
    timer = setTimeout(() => {
      controller.abort(new DOMException(`Idle for ${ms}ms`, 'TimeoutError'))
    }, ms)
  }

  touch()

  return { signal: controller.signal, touch, clear }
}

/**
 * One phrasing for every way a remote fetch can fail, so the URL and the
 * reason are always in the message. A timeout arrives as `TimeoutError`,
 * whose own message ("The operation was aborted due to timeout") names
 * neither the source nor the limit — and says nothing about the limit
 * being an IDLE one, which is what tells the reader that a big download
 * is not what failed.
 */
const toFetchFailure = (url: string, error: unknown): Error => {
  const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
  const reason = timedOut
    ? `timed out after ${REMOTE_FETCH_IDLE_TIMEOUT_MS / 1000}s with no data received`
    : error instanceof Error
      ? error.message
      : String(error)

  return new Error(`Could not fetch schema from ${url}: ${reason}`)
}

const fetchRemote = async (url: string, signal: AbortSignal): Promise<Response> => {
  try {
    return await fetch(url, { signal, redirect: 'follow' })
  } catch (error) {
    throw toFetchFailure(url, error)
  }
}

type ReadRemoteBodyArgs = {
  response: Response
  url: string
  timeout: IdleTimeout
}

/**
 * `response.text()` in every respect but one: each chunk that arrives
 * restarts the idle window, so a large schema on a slow link keeps
 * downloading while a stalled one still fails inside it.
 */
const readRemoteBody = async ({ response, url, timeout }: ReadRemoteBodyArgs): Promise<string> => {
  const reader = response.body?.getReader()

  if (!reader) {
    return ''
  }

  const decoder = new TextDecoder()
  const chunks: string[] = []

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      timeout.touch()
      chunks.push(decoder.decode(value, { stream: true }))
    }

    chunks.push(decoder.decode())

    return chunks.join('')
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

/**
 * `Content-Type` → `FileType`, or `null` when the header names nothing
 * we can parse. The header may carry parameters (`; charset=…`,
 * `;version=3.0`), which are stripped first.
 *
 * Matching is exact on the common types, then falls back to the
 * structured suffix (RFC 6839): `application/vnd.oai.openapi+json` — the
 * media type registered for OpenAPI — `application/openapi+json` and
 * their `+yaml` counterparts all state the format unambiguously in the
 * suffix, and a server setting one of them should not be told the format
 * could not be determined.
 */
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
    // `application/vnd.oai.openapi` with no suffix is YAML by
    // registration — the OpenAPI spec's default serialization.
    case 'application/vnd.oai.openapi':
      return 'yaml'
    default:
      if (mime.endsWith('+json')) return 'json'
      if (mime.endsWith('+yaml')) return 'yaml'
      return null
  }
}

/**
 * Content types that positively identify a document that is NOT a schema.
 *
 * The shape this exists for: a source behind SSO 302s to a login page,
 * which answers `200 text/html`. Without this, the requested URL's
 * `.json` would still "identify" the format and hand an HTML page to the
 * JSON parser, so the user reads a syntax error instead of learning they
 * were redirected somewhere else.
 */
const isNonSchemaContentType = (contentType: string): boolean => {
  const mime = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? ''

  return mime === 'text/html' || mime === 'application/xhtml+xml'
}

const toFileTypeOrNull = (path: string): FileType | null => {
  try {
    return toFileType(path)
  } catch {
    return null
  }
}

type ToRemoteFileTypeArgs = {
  /** The URL the response actually came from. */
  finalUrl: string
  contentType: string
  /** The URL the user pinned, before any redirect. */
  requestedUrl: string
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
 *      the user pinned is the last real evidence of intent — UNLESS the
 *      `Content-Type` has already said the body is not a schema.
 *
 * Detection expects the *response body* to be a parseable schema
 * document — for live GraphQL HTTP endpoints that only accept POSTed
 * introspection queries, run introspection yourself and save the SDL to
 * a file.
 */
const toRemoteFileType = ({
  finalUrl,
  contentType,
  requestedUrl
}: ToRemoteFileTypeArgs): FileType => {
  // The extension check reads the pathname; the error message reports the
  // whole URL — when a redirect lands somewhere unexpected, the host that
  // answered is the single most useful fact.
  const detected =
    toFileTypeOrNull(new URL(finalUrl).pathname) ??
    toFileTypeFromContentType(contentType) ??
    (isNonSchemaContentType(contentType) ? null : toFileTypeOrNull(new URL(requestedUrl).pathname))

  if (detected) return detected

  const requestedNote = requestedUrl === finalUrl ? '' : ` (nor the requested '${requestedUrl}')`

  // Naming the redirect explicitly, because "it returned a web page" is
  // the answer and "no recognized extension" is not.
  const htmlNote = isNonSchemaContentType(contentType)
    ? ` The response is an HTML document, so the source most likely redirected to a login or error page instead of serving the schema.`
    : ''

  throw new Error(
    `Could not determine schema format for remote source: '${finalUrl}'${requestedNote} has no recognized extension (.json, .yaml, .yml, .graphql, .gql, or .graphqls), and Content-Type '${contentType}' is not a JSON, YAML or GraphQL media type.${htmlNote} ` +
      `For live GraphQL HTTP endpoints, run an introspection query yourself and save the SDL to a local file.`
  )
}

/**
 * The provenance label for a resolved schema source — what gets recorded
 * as `schemaSrc` in the anchors / gen-maps payload.
 *
 * For a REMOTE source this is the final, post-redirect URL, so a pin
 * that redirects to a content-addressed form is attributed to the form
 * it actually read.
 *
 * The query survives only when NOTHING redirected. That split matters
 * both ways. A redirect target's query is server-generated and a
 * presigned one carries credentials (`X-Amz-Signature`), which must not
 * land in a committed gen-map. But when the URL is the one the user
 * pinned, its query is often the identity of the schema — the `?raw`
 * form, `?version=3` — and dropping it leaves a `schemaSrc` that fetches
 * a different document, defeating the field's whole purpose.
 *
 * For a LOCAL source the label is the string the user wrote, NOT the
 * resolved path — `toSchemaContents` absolutizes relative paths, and
 * writing `/Users/<name>/…` into a committed gen-map would leak the
 * developer's home directory and churn the file per machine.
 */
export const toAttributedSource = (requested: string, resolved: SchemaSource): string => {
  if (resolved.type === 'local') return requested

  const url = new URL(resolved.url)
  url.hash = ''

  const requestedUrl = new URL(requested)
  requestedUrl.hash = ''

  if (url.href !== requestedUrl.href) {
    url.search = ''
  }

  return url.href
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

  // `.trim()`, matching the remote path: a whitespace-only file is as
  // empty as an absent one, and would otherwise resurface downstream as
  // an opaque parse error. A file that exists but says nothing is a
  // mistake to fix, not a source to work around — hence the config error.
  if (!contents.trim()) {
    throw new SchemaConfigError(`Schema file at "${path}" is empty`)
  }

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
    throw new SchemaConfigError(
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
