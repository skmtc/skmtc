/**
 * JSR registry URL resolution + reachability check.
 *
 * The CLI is pinned to a local JSR mirror (`https://jsr.skmtc.dev/` by
 * default) so generator installs and downloads resolve against a known
 * registry rather than upstream `jsr.io`. The `JSR_URL` environment
 * variable overrides the default for local development against a
 * different mirror. The Deno runtime honours the same variable for
 * `jsr:` import resolution, so setting it once keeps both paths in
 * agreement.
 *
 * `assertJsrReachable` runs once at CLI start-up and throws with an
 * actionable error if the registry is unreachable — we'd rather fail
 * fast at the entrypoint than silently no-op deep inside an install or
 * a worker bundle.
 */

const DEFAULT_JSR_URL = 'https://jsr.skmtc.dev/'

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '')

export const getJsrBaseUrl = (): string => {
  const fromEnv = Deno.env.get('JSR_URL')
  return stripTrailingSlash(fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_JSR_URL)
}

export const toJsrUrl = (path: string): string => {
  const base = getJsrBaseUrl()
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

export class JsrRegistryUnreachableError extends Error {
  readonly baseUrl: string

  constructor(baseUrl: string, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    super(
      [
        `JSR registry at ${baseUrl} is unreachable (${reason}).`,
        '',
        'skmtc is pinned to a local JSR mirror. Start the registry or set',
        'JSR_URL to a reachable mirror before running the CLI:',
        '',
        '  JSR_URL=https://jsr.skmtc.dev/ skmtc <command>',
        '',
        'If you are intentionally working offline, the only commands that do',
        'not touch JSR are `skmtc generate` (when bundle.js is already built)',
        'and `skmtc dev` against a project with no new generator installs.'
      ].join('\n'),
      { cause }
    )
    this.name = 'JsrRegistryUnreachableError'
    this.baseUrl = baseUrl
  }
}

export const assertJsrReachable = async (
  options: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<void> => {
  const baseUrl = getJsrBaseUrl()
  const timeoutMs = options.timeoutMs ?? 3000

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs)

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(options.signal!.reason), {
      once: true
    })
  }

  try {
    const probeUrl = `${baseUrl}/`
    const response = await fetch(probeUrl, {
      method: 'HEAD',
      signal: controller.signal
    })

    // The registry root may legitimately return 404/405 — we only care
    // that the host answered, not that the path exists.
    if (response.status >= 500) {
      throw new Error(`registry returned HTTP ${response.status}`)
    }
  } catch (error) {
    throw new JsrRegistryUnreachableError(baseUrl, error)
  } finally {
    clearTimeout(timeoutId)
  }
}
