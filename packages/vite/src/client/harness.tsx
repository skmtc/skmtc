// The in-iframe render harness — runs in the BROWSER, transformed by the
// consumer app's own Vite (so it shares the app's React and gets
// `import.meta.hot`). Served by the plugin as a virtual module; mounts on import.
//
// Ported from apps/preview/container/harness/client (skmtc-preview + lazy-retry +
// entry, combined into one module for virtual-module serving). It reads
// `?module=&export=` from the iframe URL, imperatively imports the generated
// artifact (cache-busted, `@vite-ignore`), and owns HMR itself — cancelling the
// artifact-triggered full reload and swapping in place — because third-party
// generators co-export a component AND a value from one file, which trips React
// Fast Refresh into a full reload (a "Loading…" flash) on every edit.
//
// Excluded from the package's `tsc` typecheck (browser env, app's React); its
// correctness is validated at runtime.

import { Component, Suspense, lazy, useEffect, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

const isComponent = (value: unknown): value is ComponentType<unknown> => typeof value === 'function'
const isWrapper = (value: unknown): value is ComponentType<{ children: ReactNode }> =>
  typeof value === 'function'

/** `React.lazy` that retries a failed dynamic import with backoff — a module can
 *  momentarily 404 while Vite re-processes a just-written file mid-regenerate. */
const lazyRetry = <T extends ComponentType<unknown>>(
  importer: () => Promise<{ default: T }>
): ReturnType<typeof lazy<T>> => {
  const retryImport = async (): Promise<{ default: T }> => {
    try {
      return await importer()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const prefix = 'Failed to fetch dynamically imported module: '
      if (!message.startsWith(prefix)) throw error
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000 * 2 ** attempt))
        const url = new URL(message.slice(prefix.length).trim())
        url.searchParams.set('t', `${Date.now()}`)
        try {
          return await import(/* @vite-ignore */ url.href)
        } catch {
          // try again until exhausted
        }
      }
      throw error
    }
  }
  return lazy(retryImport)
}

const PassThrough = ({ children }: { children: ReactNode }) => <>{children}</>

type PreviewStatus =
  | { source: 'skmtc-preview'; kind: 'ready' }
  | { source: 'skmtc-preview'; kind: 'error'; message: string }
const postStatus = (status: PreviewStatus): void => {
  if (window.parent && window.parent !== window) window.parent.postMessage(status, '*')
}

// Forward this iframe's console + uncaught errors to the editor parent, so the
// preview's <WebPreviewConsole> can surface them — the editor document can't read
// a separate iframe's console. Runs once, before the artifact mounts, so it also
// catches Vite HMR failures (404s on a missing artifact) and React warnings.
const forwardConsoleToParent = (): void => {
  if (!window.parent || window.parent === window) return
  const post = (level: 'log' | 'warn' | 'error', message: string): void =>
    window.parent.postMessage(
      { source: 'skmtc-preview-console', level, message, at: Date.now() },
      '*'
    )
  const serialize = (args: unknown[]): string =>
    args
      .map((arg) => {
        if (typeof arg === 'string') return arg
        try {
          return JSON.stringify(arg)
        } catch {
          return String(arg)
        }
      })
      .join(' ')
  for (const level of ['log', 'warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]): void => {
      post(level, serialize(args))
      original(...args)
    }
  }
  window.addEventListener('error', (event) => {
    post('error', `${event.message}${event.filename ? ` (${event.filename}:${event.lineno})` : ''}`)
  })
  window.addEventListener('unhandledrejection', (event) => {
    post('error', event.reason instanceof Error ? event.reason.message : String(event.reason))
  })
}
forwardConsoleToParent()

const isApiTokenMessage = (data: unknown): data is { token: string } =>
  typeof data === 'object' &&
  data !== null &&
  'source' in data &&
  data.source === 'skmtc-editor' &&
  'type' in data &&
  data.type === 'api-token' &&
  'token' in data &&
  typeof data.token === 'string'

// Mark this surface as the preview and inject the API token the way the consumer
// app expects. The generated app's fetch wrapper reads `__SKMTC_PREVIEW__` (to use
// the injected token instead of an OAuth browser session, which would redirect the
// iframe away) and `__SKMTC_PREVIEW_API_TOKEN__` (the bearer token). The token is
// the one the user sets in the editor's "API token" tab, delivered either via
// same-origin localStorage + its `storage` event, OR — the usual case, since the
// editor (desktop shell / :4820) and this iframe (the plugin origin) are DIFFERENT
// origins where localStorage never crosses — via a postMessage from the editor.
// Data queries already ran (and failed) without a token, so reload on change to
// refetch with it.
const applyApiToken = (): void => {
  const KEY = 'skmtc-api-token'
  const read = (): string => {
    try {
      return localStorage.getItem(KEY) ?? ''
    } catch {
      return ''
    }
  }
  const write = (token: string): void => {
    try {
      if (token) localStorage.setItem(KEY, token)
      else localStorage.removeItem(KEY)
    } catch {
      // ignore (private mode, quota, …)
    }
  }
  const globals = window as unknown as {
    __SKMTC_PREVIEW__?: boolean
    __SKMTC_PREVIEW_API_TOKEN__?: string
  }
  globals.__SKMTC_PREVIEW__ = true
  globals.__SKMTC_PREVIEW_API_TOKEN__ = read() || undefined

  // Adopt a token and refetch. Persist it to THIS origin's store FIRST so it
  // survives the reload — otherwise a postMessage-fed token is lost on reload,
  // the iframe restarts tokenless, and the editor's re-post loops forever.
  const adopt = (token: string): void => {
    const next = token || undefined
    write(token)
    if (globals.__SKMTC_PREVIEW_API_TOKEN__ === next) return
    globals.__SKMTC_PREVIEW_API_TOKEN__ = next
    window.location.reload()
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return
    adopt(read())
  })
  window.addEventListener('message', (event) => {
    if (isApiTokenMessage(event.data)) adopt(event.data.token)
  })
}
applyApiToken()

const Loading = () => <div className="skmtc-preview-loading">Loading…</div>

const ErrorView = ({ message }: { message: string }) => (
  <div className="skmtc-preview-error">
    <span>Preview failed to render</span>
    <pre>{message}</pre>
  </div>
)

// Optional project provider wrapper. Generated components run with the app's
// context (React Query, theme, global CSS, …); the app may export
// `PreviewProviders` from `src/preview-providers.tsx`. The specifier is a
// VIRTUAL id the plugin resolves server-side — to the consumer's file when it
// exists, to a pass-through when it doesn't — so an absent file never logs a
// browser module-load error. Static specifier, no `@vite-ignore`: Vite's import
// analysis must rewrite it. The catch guards a providers file that throws.
const loadProviders = async (): Promise<ComponentType<{ children: ReactNode }>> => {
  try {
    const loaded: Record<string, unknown> = await import('virtual:skmtc-preview-providers')
    const candidate = loaded.PreviewProviders ?? loaded.default
    return isWrapper(candidate) ? candidate : PassThrough
  } catch {
    return PassThrough
  }
}

// The project providers as their OWN lazy boundary — a STABLE outer wrapper that
// resolves once and does NOT re-resolve when the artifact hot-updates, so the
// app context never flashes or remounts mid-edit.
const Providers = lazyRetry<ComponentType<{ children: ReactNode }>>(async () => ({
  default: await loadProviders()
}))

const ReadyPing = () => {
  useEffect(() => postStatus({ source: 'skmtc-preview', kind: 'ready' }), [])
  return null
}

type BoundaryProps = { children: ReactNode }
type BoundaryState = { message: string | null }

class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { message: null }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  override componentDidCatch(error: unknown): void {
    postStatus({
      source: 'skmtc-preview',
      kind: 'error',
      message: error instanceof Error ? error.message : String(error)
    })
  }

  override render(): ReactNode {
    return this.state.message !== null ? (
      <ErrorView message={this.state.message} />
    ) : (
      this.props.children
    )
  }
}

type ArtifactState = {
  Comp: ComponentType<unknown> | null
  error: string | null
  version: number
}

/**
 * The previewed artifact, loaded imperatively and hot-swapped IN PLACE. We do
 * NOT render it through `React.lazy`/Fast Refresh — mixed-export artifacts trip
 * the React plugin into `import.meta.hot.invalidate()` → full reload → flash. So
 * the harness owns the lifecycle: load imperatively, cancel the artifact-
 * triggered full reload (`vite:beforeFullReload`), re-import + swap.
 */
const ArtifactView = () => {
  const [state, setState] = useState<ArtifactState>({ Comp: null, error: null, version: 0 })

  useEffect(() => {
    const params = new URL(window.location.href).searchParams
    const modulePath = params.get('module')
    const exportName = params.get('export') ?? 'default'
    if (!modulePath) {
      const message = 'preview harness: missing ?module'
      setState({ Comp: null, error: message, version: 0 })
      postStatus({ source: 'skmtc-preview', kind: 'error', message })
      return
    }

    let alive = true
    let seq = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const reimport = async (): Promise<void> => {
      const mine = (seq += 1)
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          const loaded: Record<string, unknown> = await import(
            /* @vite-ignore */ `${modulePath}?t=${Date.now()}`
          )
          if (!alive || mine !== seq) return
          const candidate = loaded[exportName]
          if (!isComponent(candidate)) {
            throw new Error(`module ${modulePath} has no component export "${exportName}"`)
          }
          setState({ Comp: candidate, error: null, version: mine })
          return
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          const transient =
            /Failed to fetch dynamically imported module|Importing a module script failed|\b404\b/.test(
              message
            )
          if (!transient || attempt === 5) {
            if (alive && mine === seq) {
              setState((current) => ({ ...current, error: message }))
              postStatus({ source: 'skmtc-preview', kind: 'error', message })
            }
            return
          }
          await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** attempt))
        }
      }
    }

    const schedule = (): void => {
      clearTimeout(timer)
      timer = setTimeout(() => void reimport(), 150)
    }
    const touchesArtifact = (path: unknown): boolean =>
      typeof path === 'string' && path.split('?')[0].endsWith(modulePath)

    void reimport()

    const hot = import.meta.hot
    const onAfterUpdate = (payload: {
      updates?: ReadonlyArray<{ path?: string; acceptedPath?: string }>
    }): void => {
      const updates = payload.updates ?? []
      if (
        updates.some((entry) => touchesArtifact(entry.path) || touchesArtifact(entry.acceptedPath))
      ) {
        schedule()
      }
    }
    // Cancel only FILE-CHANGE full reloads (they carry `triggeredBy`) and swap
    // the artifact in place instead. Reloads without `triggeredBy` — above all
    // the optimizer's after a newly discovered dep re-bundles the dep chunks —
    // must proceed: the shared chunks' hashes changed, so re-importing just the
    // artifact would load a SECOND React copy against the harness's stale one
    // ("Cannot read properties of null (reading 'useRef')").
    const onBeforeFullReload = (payload: { path?: string; triggeredBy?: string }): void => {
      if (payload.triggeredBy === undefined) return
      if (!payload.path || !payload.path.endsWith('.html')) {
        payload.path = '/__skmtc_no_reload.html'
        schedule()
      }
    }
    if (hot) {
      hot.on('vite:afterUpdate', onAfterUpdate)
      hot.on('vite:beforeFullReload', onBeforeFullReload)
    }

    return () => {
      alive = false
      clearTimeout(timer)
      if (hot) {
        hot.off('vite:afterUpdate', onAfterUpdate)
        hot.off('vite:beforeFullReload', onBeforeFullReload)
      }
    }
  }, [])

  if (state.error !== null) return <ErrorView message={state.error} />
  if (state.Comp === null) return <Loading />
  const Artifact = state.Comp
  return (
    <ErrorBoundary key={state.version}>
      <Artifact />
      <ReadyPing />
    </ErrorBoundary>
  )
}

const SkmtcPreview = () => (
  <ErrorBoundary>
    <Suspense fallback={<Loading />}>
      <Providers>
        <ArtifactView />
      </Providers>
    </Suspense>
  </ErrorBoundary>
)

const container = document.getElementById('root')
if (!container) throw new Error('preview harness: missing #root element')
createRoot(container).render(<SkmtcPreview />)
