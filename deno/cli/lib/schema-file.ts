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
 * window. An idle-only budget would regress the "40MB spec over a
 * congested VPN" case that worked before any timeout existed.
 */
const REMOTE_FETCH_IDLE_TIMEOUT_MS = 30_000

/**
 * The ceiling an idle budget cannot provide on its own.
 *
 * A response that trickles one byte every few seconds resets the idle
 * window forever, so without this a mistyped SSE endpoint — or a proxy
 * emitting keep-alive whitespace during a long backend render — hangs
 * the command and grows the buffer without bound. Five minutes is far
 * beyond any real schema download and well short of burning a CI job.
 */
const REMOTE_FETCH_TOTAL_TIMEOUT_MS = 5 * 60_000

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
   * EVERY failure is tolerated here, including a misconfigured project
   * (two schema files at the default locations, an empty file). Letting
   * those through as throws crashes `list`, `clean`, `install` and the
   * bare prompt with an uncaught exception and an empty stdout — the
   * recovery commands included — which is worse than a warning even
   * though a warning is easy to miss. Surfacing misconfiguration as
   * structured output belongs in the commands, via `strict-mode.ts`,
   * not in a throw from the root open.
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
        // One deadline for the whole exchange — an idle window reset by
        // every chunk, under a total ceiling that never resets.
        // `clear()` in `finally` so a fast success does not leave a
        // pending timer holding the event loop open.
        const deadline = toFetchDeadline({
          idleMs: REMOTE_FETCH_IDLE_TIMEOUT_MS,
          totalMs: REMOTE_FETCH_TOTAL_TIMEOUT_MS
        })

        try {
          const response = await fetchRemote(schemaSource.url, deadline.signal)

          deadline.startBody()

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
          const contents = await readRemoteBody({ response, url: schemaSource.url, deadline })

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
          deadline.clear()
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

export type FetchDeadline = {
  /** Pass to `fetch`; aborts when either budget runs out. */
  signal: AbortSignal
  /** The response has started; subsequent stalls are body stalls. */
  startBody: () => void
  /** Restart the idle window — call whenever bytes arrive. */
  touch: () => void
  /** Stop the timers. Always call, or they hold the event loop open. */
  clear: () => void
}

type ToFetchDeadlineArgs = {
  /** Longest gap with no bytes before the fetch is abandoned. */
  idleMs: number
  /** Longest the whole exchange may run, however steadily it drips. */
  totalMs: number
}

/**
 * Two budgets on one signal.
 *
 * The IDLE one resets on progress, so the size of the schema stops
 * mattering and a slow-but-healthy download is not cut off — which a
 * single total cap gets wrong. The TOTAL one never resets, because an
 * idle budget alone can be held open forever by a response that trickles
 * a byte every few seconds.
 *
 * Both abort with a `TimeoutError` whose message is the finished
 * sentence {@link toFetchFailure} reports, so the four cases — waiting
 * for a response, stalled mid-body, and the ceiling in either phase —
 * each name what actually happened.
 */
export const toFetchDeadline = ({ idleMs, totalMs }: ToFetchDeadlineArgs): FetchDeadline => {
  const controller = new AbortController()

  // Mutable: the idle timer is rescheduled on every chunk, and the
  // phrasing changes once the response has started.
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let started = false

  const abort = (message: string) => {
    controller.abort(new DOMException(message, 'TimeoutError'))
  }

  const totalTimer = setTimeout(() => {
    abort(`exceeded the ${totalMs / 60_000}m limit for a single fetch`)
  }, totalMs)

  const clear = () => {
    clearTimeout(totalTimer)

    if (idleTimer !== undefined) {
      clearTimeout(idleTimer)
      idleTimer = undefined
    }
  }

  const touch = () => {
    if (idleTimer !== undefined) {
      clearTimeout(idleTimer)
    }

    idleTimer = setTimeout(() => {
      abort(
        started
          ? `timed out after ${idleMs / 1000}s with no data received`
          : `timed out after ${idleMs / 1000}s waiting for a response`
      )
    }, idleMs)
  }

  const startBody = () => {
    started = true
    touch()
  }

  touch()

  return { signal: controller.signal, startBody, touch, clear }
}

/**
 * One phrasing for every way a remote fetch can fail, so the URL and the
 * reason are always in the message. The reason for a timeout comes from
 * {@link toFetchDeadline}, which knows which budget ran out and whether
 * the response had started — `TimeoutError`'s own message ("The
 * operation was aborted due to timeout") names neither the source, the
 * limit, nor which of the two it was.
 */
const toFetchFailure = (url: string, error: unknown): Error => {
  const reason =
    error instanceof DOMException && error.name === 'TimeoutError'
      ? error.message
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
  deadline: FetchDeadline
}

/**
 * `response.text()` in every respect but one: each chunk that arrives
 * restarts the idle window, so a large schema on a slow link keeps
 * downloading while a stalled one still fails inside it.
 */
const readRemoteBody = async ({ response, url, deadline }: ReadRemoteBodyArgs): Promise<string> => {
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

      deadline.touch()
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
 * The shape this exists for: a source behind SSO answers a login page
 * with `200 text/html`. It may 302 first, or — for a proxy that
 * preserves the URL — serve the page in place at the pinned `.json`.
 * Either way an extension would still "identify" the format and hand an
 * HTML page to the JSON parser, so the user reads a syntax error instead
 * of learning they never reached the schema.
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
 *      the user pinned is the last real evidence of intent.
 *
 * A `Content-Type` that positively identifies a non-schema document
 * short-circuits ALL THREE. It has to come first: an SSO proxy that
 * serves its login page in place answers `200 text/html` at the pinned
 * `/openapi.json`, so step 1 would otherwise match the extension and
 * hand HTML to the JSON parser.
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
  const redirected = requestedUrl !== finalUrl

  if (isNonSchemaContentType(contentType)) {
    const from = redirected ? ` (requested '${requestedUrl}')` : ''

    throw new Error(
      `Schema source '${finalUrl}'${from} answered with Content-Type '${contentType}', an HTML document rather than a schema. ` +
        `A source behind SSO or an authenticating proxy typically answers this way with a login page — either where it redirected to, or in place at the URL you pinned. ` +
        `Bundle the spec to a local file, or point \`source\` at a local proxy that injects the credential.`
    )
  }

  // The extension check reads the pathname; the error message reports the
  // whole URL — when a redirect lands somewhere unexpected, the host that
  // answered is the single most useful fact.
  const detected =
    toFileTypeOrNull(new URL(finalUrl).pathname) ??
    toFileTypeFromContentType(contentType) ??
    toFileTypeOrNull(new URL(requestedUrl).pathname)

  if (detected) return detected

  const requestedNote = redirected ? ` (nor the requested '${requestedUrl}')` : ''

  throw new Error(
    `Could not determine schema format for remote source: '${finalUrl}'${requestedNote} has no recognized extension (.json, .yaml, .yml, .graphql, .gql, or .graphqls), and Content-Type '${contentType}' is not a JSON, YAML or GraphQL media type. ` +
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
 * Gen-maps are COMMITTED files, so nothing secret may reach this string.
 * Userinfo goes unconditionally, and so does every query parameter whose
 * name says it carries a credential — a presigned URL pinned directly is
 * as dangerous as one redirected to, and the CLI has no auth mechanism,
 * so passing a presigned URL as `source` is a workflow the docs actively
 * recommend.
 *
 * What remains of the query survives only when NOTHING redirected. A
 * redirect target's query is server-generated: unknowable in general, so
 * it goes wholesale. The URL the user pinned is knowable, and its query
 * is often the identity of the schema — the `?raw` form, `?version=3` —
 * where dropping it would leave a `schemaSrc` that fetches a different
 * document, defeating the field's whole purpose.
 *
 * For a LOCAL source the label is the string the user wrote, NOT the
 * resolved path — `toSchemaContents` absolutizes relative paths, and
 * writing `/Users/<name>/…` into a committed gen-map would leak the
 * developer's home directory and churn the file per machine.
 */
export const toAttributedSource = (requested: string, resolved: SchemaSource): string => {
  if (resolved.type === 'local') return requested

  const url = toRecordableUrl(resolved.url)
  const requestedUrl = toRecordableUrl(requested)

  if (url.href !== requestedUrl.href) {
    url.search = ''

    return url.href
  }

  for (const name of [...url.searchParams.keys()]) {
    if (isCredentialParameter(name)) {
      url.searchParams.delete(name)
    }
  }

  return url.href
}

/** Everything that must never be committed, off — before any comparison,
 *  so a credential can't decide whether two URLs are the same. */
const toRecordableUrl = (source: string): URL => {
  const url = new URL(source)

  url.hash = ''
  url.username = ''
  url.password = ''

  return url
}

/** Vendors that sign a URL by adding a family of parameters, all of
 *  which are credential material. */
const CREDENTIAL_PARAMETER_PREFIXES = ['x-amz-', 'x-goog-', 'x-ms-', 'x-obs-']

/** Matched on the WHOLE name, never as a substring — `sig` as a
 *  substring would strip `?design=…`. */
const CREDENTIAL_PARAMETER_NAMES = new Set([
  'access_key',
  'access_token',
  'accesskey',
  'accesstoken',
  'api_key',
  'api-key',
  'apikey',
  'auth',
  'authorization',
  'credential',
  'credentials',
  'key',
  'passwd',
  'password',
  'pwd',
  'sas',
  'secret',
  'sig',
  'signature',
  'token'
])

const isCredentialParameter = (name: string): boolean => {
  const lowerName = name.toLowerCase()

  return (
    CREDENTIAL_PARAMETER_NAMES.has(lowerName) ||
    CREDENTIAL_PARAMETER_PREFIXES.some(prefix => lowerName.startsWith(prefix))
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

  // `.trim()`, matching the remote path: a whitespace-only file is as
  // empty as an absent one, and would otherwise resurface downstream as
  // an opaque parse error.
  if (!contents.trim()) {
    throw new Error(`Schema file at "${path}" is empty`)
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
