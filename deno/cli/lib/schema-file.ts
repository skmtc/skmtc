import { exists } from '@std/fs/exists'
import { resolve } from '@std/path/resolve'
import { join } from '@std/path/join'
import { toProjectPath } from '@/lib/to-project-path.ts'
import { toRootPath } from '@/lib/to-root-path.ts'
import invariant from 'tiny-invariant'
import type { SchemaSource } from '@/lib/types.ts'
import { toSchemaContents } from './to-schema-contents.ts'

type ConstructorArgs = {
  schemaSource: SchemaSource
  contents: string
}

/**
 * Which conventional filename to probe for. This is about LOCATING a
 * schema file, not classifying one — what a document turns out to be is
 * read from the document itself, in `@skmtc/convert`.
 */
type DefaultSchemaFile = 'json' | 'yaml' | 'graphql'

type ToPathArgs = {
  projectName: string
  fileType: DefaultSchemaFile
  useParent: boolean
}

export type RemoteBudget = {
  /** Longest gap with no bytes before the fetch is abandoned. */
  idleMs: number
  /** Longest the whole exchange may run, however steadily it drips. */
  totalMs: number
}

/**
 * What a command that ACTUALLY WANTS the schema will wait.
 *
 * The idle budget resets on every chunk that arrives, so a large spec on
 * a slow-but-progressing link still completes — a total cap alone would
 * regress the "40MB spec over a congested VPN" case that worked before
 * any timeout existed. The total budget is the ceiling an idle one
 * cannot provide: a response that trickles a byte every few seconds
 * resets the idle window forever, so without it a mistyped SSE endpoint
 * — or a proxy emitting keep-alive whitespace during a long backend
 * render — hangs the command and grows the buffer without bound.
 */
const GENERATE_BUDGET: RemoteBudget = { idleMs: 30_000, totalMs: 5 * 60_000 }

/**
 * What a command that does NOT want the schema will wait.
 *
 * `SkmtcRoot.open` opens every project, so this budget governs `list`,
 * `clean`, `install` and the bare prompt. None of them need the schema,
 * and they should not inherit a ceiling sized for downloading one: a
 * single project pinned to a trickling host would hold all of them for
 * minutes.
 */
const ROOT_OPEN_BUDGET: RemoteBudget = { idleMs: 10_000, totalMs: 30_000 }

export class SchemaFile {
  contents: string | null
  schemaSource: SchemaSource | null

  private constructor(args?: ConstructorArgs) {
    this.schemaSource = args?.schemaSource || null
    this.contents = args?.contents || null
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
   *
   * A remote source here also gets {@link ROOT_OPEN_BUDGET} rather than
   * the generous one `generate` uses — a schema nobody asked for must
   * not hold up the command for minutes.
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
      return await SchemaFile.openFromSource(source, ROOT_OPEN_BUDGET)
    }

    const defaultFileInfo = await findSchemaFile({ projectName })

    if (!defaultFileInfo) {
      return new SchemaFile()
    }

    const contents = await openPath(defaultFileInfo.path)

    return new SchemaFile({
      schemaSource: { type: 'local', path: defaultFileInfo.path },
      contents
    })
  }

  static async openFromSource(
    schemaSourceString: string,
    budget: RemoteBudget = GENERATE_BUDGET
  ): Promise<SchemaFile> {
    const { contents, schemaSource } = await toSchemaContents(schemaSourceString, budget)

    return new SchemaFile({ schemaSource, contents })
  }

  static async getFromSource(
    schemaSource: SchemaSource,
    budget: RemoteBudget = GENERATE_BUDGET
  ): Promise<{ contents: string; schemaSource: SchemaSource }> {
    switch (schemaSource.type) {
      case 'remote': {
        // One deadline for the whole exchange — an idle window reset by
        // every chunk, under a total ceiling that never resets.
        // `clear()` in `finally` so a fast success does not leave a
        // pending timer holding the event loop open.
        const deadline = toFetchDeadline(budget)

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

          return {
            contents,
            schemaSource: { type: 'remote', url: finalUrl }
          }
        } finally {
          deadline.clear()
        }
      }
      case 'local': {
        const contents = await openPath(resolve(schemaSource.path))

        return {
          contents,
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
 * sentence {@link toFetchFailure} reports, so the three reachable cases
 * — waiting for a response, stalled mid-body, and the ceiling — each
 * name what actually happened. (The ceiling can only be reached once the
 * body is arriving: nothing calls `touch()` before `startBody()`, so
 * before that the shorter idle window always trips first.)
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

/**
 * The provenance label for a resolved schema source.
 *
 * A REMOTE source is recorded as the final, post-redirect URL, COMPLETE
 * — query included. skmtc-hub's `?raw` surface is the case that decides
 * this: `/{account}/apis/{api}?raw` redirects to
 * `/{account}/apis/{api}/versions/{ref}?raw`, and the same URL without
 * `?raw` is the HTML page, not the document. Dropping the query would
 * record a URL that no longer names what was read, breaking the
 * "redirect is the lockfile" contract the hub is built around. This
 * matches `@skmtc/server`, which records `resolvedUrl: target.href`.
 *
 * Userinfo is stripped: gen-maps are committed files, and a credential
 * there is never what identifies the document.
 *
 * A LOCAL source is recorded as the string the user wrote, NOT the
 * resolved path — `toSchemaContents` absolutizes relative paths, and
 * writing `/Users/<name>/…` into a gen-map would leak the developer's
 * home directory and churn the file per machine.
 */
export const toAttributedSource = (requested: string, resolved: SchemaSource): string => {
  if (resolved.type === 'local') return requested

  const url = new URL(resolved.url)

  // Userinfo is the one part that is never identity. Deno keeps it on
  // `response.url`, and unlike the query it cannot be what distinguishes
  // one document from another — a hub `?raw` URL carries none.
  url.username = ''
  url.password = ''

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
  // an opaque parse error.
  if (!contents.trim()) {
    throw new Error(`Schema file at "${path}" is empty`)
  }

  return contents
}

type FindSchemaFileResult = {
  fileType: DefaultSchemaFile
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
