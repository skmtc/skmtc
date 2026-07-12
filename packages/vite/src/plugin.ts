// The skmtc preview Vite plugin: a thin local backend that turns the consumer
// app's own dev server into the preview surface. It serves the project's
// `describe` metadata and on-disk `client.json`, applies enrichment edits to the
// file, and spawns `skmtc generate` so the generated code lands in `basePath`
// and Vite HMR repaints it. No container, no R2, no flat config — the working
// tree is the contract.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { join, resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import * as v from 'valibot'
import type { Connect, Plugin } from 'vite'
import { runDescribe, runGenerate, type CliResult } from './skmtc-cli.ts'
import {
  applyEditToClientJson,
  basePathOf,
  clientJsonPath,
  enrichmentEditSchema,
  inputMatchesSchema,
  readClientJson,
  writeClientJson
} from './client-json.ts'
import { SourceState } from './source-state.ts'
import { moduleTypeFromDescribe } from './descriptors.ts'
import {
  HARNESS_RESOLVED_ID,
  HARNESS_SOURCE_PATH,
  IFRAME_HTML,
  PASSTHROUGH_PROVIDERS_MODULE,
  PROVIDERS_CANDIDATES,
  PROVIDERS_ID,
  PROVIDERS_RESOLVED_ID,
  findProvidersFile,
  loadClientModule,
  resolveClientModule
} from './preview-harness.ts'
import { readPreviews } from './manifest.ts'
import { previewOptimizeDeps } from './optimize-deps.ts'
import { readArtifactContent, readArtifacts } from './artifacts.ts'
import { readGenMap } from './gen-map.ts'
import { filtersWriteSchema, fromFilterEntries, toFilterEntries } from './filters.ts'
import { readSource } from './project-sources.ts'

export type SkmtcPreviewOptions = {
  /** The skmtc project under `.skmtc/<project>/` to preview. */
  project: string
  /** SKMTC root (the directory containing `.skmtc/`). Defaults to the Vite
   *  config root — for a locally-onboarded app that's the app root itself. */
  root?: string
}

const readJsonBody = (request: IncomingMessage): Promise<unknown> =>
  new Promise((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (error) {
        rejectPromise(error)
      }
    })
    request.on('error', rejectPromise)
  })

const respondJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.statusCode = status
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify(body))
}

const methodGuard =
  (method: string, handler: Connect.NextHandleFunction): Connect.NextHandleFunction =>
  (request, response, next) => {
    if (request.method !== method) {
      next()
      return
    }
    handler(request, response, next)
  }

// --- Auth ---------------------------------------------------------------------
// The dev server is often exposed on the public web via a tunnel, so every
// `/__skmtc/*` control + metadata route is gated by a per-session bearer token.
// The legitimate caller is a LOCAL client (the desktop app, occasionally a
// browser) — it obtains the token through a channel a web attacker can't reach:
// the `SKMTC_PREVIEW_TOKEN` env var (when the desktop app spawns the dev server)
// or the handshake file under `node_modules/.cache` (readable only on this
// machine). See `ensurePreviewToken`.

type PreviewAuth = { token: string; tokenFile: string }

/** Resolve the preview token — env (desktop-launched) → existing handshake file
 *  (stable across restarts) → freshly generated — and always (re)write the file
 *  so a connect-only desktop client can read it regardless of who launched the
 *  server. Anchored at the VITE root (the dev server's home, whose
 *  `node_modules` always exists), not the skmtc root — in a monorepo the repo
 *  root's `node_modules` is a coincidence of the workspace layout.
 *  `node_modules/.cache` is universally gitignored, so the token never risks
 *  being committed and needs no consumer-side ignore rule. */
const ensurePreviewToken = (viteRoot: string, project: string): PreviewAuth => {
  const dir = join(viteRoot, 'node_modules', '.cache', 'skmtc-preview')
  const tokenFile = join(dir, `${project}.token`)
  const fromEnv = process.env.SKMTC_PREVIEW_TOKEN?.trim()
  const fromFile = ((): string | null => {
    try {
      return readFileSync(tokenFile, 'utf8').trim() || null
    } catch {
      return null
    }
  })()
  const token = fromEnv || fromFile || randomBytes(32).toString('base64url')
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(tokenFile, token, { mode: 0o600 })
  } catch {
    // A read-only / unwritable tree: an env token (if set) still gates requests;
    // a connect-only desktop just can't read the handshake file here.
  }
  return { token, tokenFile }
}

const bearerToken = (request: IncomingMessage): string | null => {
  const header = request.headers.authorization
  const matched = typeof header === 'string' ? /^Bearer (.+)$/.exec(header) : null
  return matched ? matched[1] : null
}

// Constant-time compare; the length guard is required because `timingSafeEqual`
// throws on differing lengths. The token is high-entropy, so this is belt-and-
// braces rather than load-bearing.
const tokensMatch = (provided: string, expected: string): boolean => {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Gate a handler behind the preview bearer token. Reject BEFORE the body is
 *  read, so an unauthenticated caller never triggers a request-body read. */
const requireToken =
  (token: string, handler: Connect.NextHandleFunction): Connect.NextHandleFunction =>
  (request, response, next) => {
    const provided = bearerToken(request)
    if (provided === null || !tokensMatch(provided, token)) {
      respondJson(response, 401, { error: 'missing or invalid preview token' })
      return
    }
    handler(request, response, next)
  }

// The desktop shell obtains the token WITHOUT any env var or repo-path knowledge
// via an ungated `/__skmtc/handshake` that authorizes purely by network
// locality: the request must arrive on a loopback socket AND carry none of the
// headers that betray a proxy/tunnel or a browser fetch. A tunnelled caller
// (cloudflared sets `x-forwarded-for`) is refused, so a public dev server never
// leaks the token; a browser page — same- or cross-origin — always attaches
// `Origin`, so it is refused too (belt-and-braces on top of the response
// carrying no CORS headers). Only a same-machine, non-browser process (the Deno
// shell, whose server-side `fetch` sends none of these) is trusted.
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const NON_LOCAL_HEADERS = [
  'x-forwarded-for',
  'forwarded',
  'cf-connecting-ip',
  'x-real-ip',
  'origin'
]

const isLocalRequest = (request: IncomingMessage): boolean => {
  const address = request.socket.remoteAddress
  if (address === undefined || !LOOPBACK_ADDRESSES.has(address)) return false
  return NON_LOCAL_HEADERS.every(header => request.headers[header] === undefined)
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** `skmtcPreview({ project })` — add to a consumer app's `vite.config` (dev). */
export function skmtcPreview(options: SkmtcPreviewOptions): Plugin {
  let root = options.root ?? process.cwd()
  let viteRoot = process.cwd()

  // describe is a pure function of (schema, bundle) — cache it, invalidate on a
  // bundle change.
  let describeCache: Promise<CliResult> | null = null
  const describe = (): Promise<CliResult> => {
    describeCache ??= runDescribe(root, options.project)
    return describeCache
  }

  // Serialize edit→write→generate so concurrent rail edits never spawn parallel
  // generates or race the client.json write; each runs against the latest file.
  let chain: Promise<unknown> = Promise.resolve()
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const result = chain.then(task)
    chain = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  return {
    name: 'skmtc-preview',
    // Dev-server surface only (middleware, virtual modules, optimizer entries)
    // — provably inert in production builds.
    apply: 'serve',
    // Run BEFORE Worker-runtime plugins: @cloudflare/vite-plugin registers its
    // request-routing middleware with `enforce: 'pre'`, and a later-registered
    // `/__skmtc/*` handler would lose the ungated handshake to the Worker's
    // SPA/404. Vite keeps ARRAY order within the `pre` class, so consumers must
    // also list `skmtcPreview` before such plugins in `plugins: []`.
    enforce: 'pre',
    // Contribute the generated tree as extra optimizer scan entries, so every
    // dep a preview can pull in is optimized up front and a preview load never
    // triggers a mid-load re-optimize (the 504 "Outdated Optimize Dep" wedge).
    // Additive only — Vite's own discovery and interop stay in charge (see
    // optimize-deps.ts for why overriding them breaks monorepos and CJS deps).
    config(userConfig) {
      const viteRoot = resolve(process.cwd(), userConfig.root ?? '.')
      return {
        optimizeDeps: previewOptimizeDeps({
          viteRoot,
          skmtcRoot: options.root ?? viteRoot,
          project: options.project
        })
      }
    },
    configResolved(config) {
      viteRoot = config.root
      root = options.root ?? config.root
    },
    // The browser client modules (render harness + editor) are virtual modules
    // so the CONSUMER's Vite transforms them (shared React + `import.meta.hot`).
    // The providers id resolves to the consumer's file when one exists, else to
    // a served pass-through — existence is decided here, server-side, so an
    // absent file never surfaces as a browser-console module-load error.
    resolveId(id) {
      if (id === PROVIDERS_ID) return findProvidersFile(viteRoot) ?? PROVIDERS_RESOLVED_ID
      return resolveClientModule(id)
    },
    load(id) {
      if (id === PROVIDERS_RESOLVED_ID) return PASSTHROUGH_PROVIDERS_MODULE
      return loadClientModule(id)
    },
    configureServer(server) {
      // Gate every `/__skmtc/*` route (except the static iframe bootstrap and the
      // loopback handshake) with a per-session bearer token — the dev server may
      // be tunnelled to the public web. The desktop app obtains the token
      // automatically over `/__skmtc/handshake` (loopback-only); the token is
      // also logged for the env-var and handshake-file fallbacks.
      const auth = ensurePreviewToken(viteRoot, options.project)
      server.config.logger.info(
        `\n  skmtc preview auth enabled\n  token: ${auth.token}\n  handshake file: ${auth.tokenFile}\n`
      )

      // The watcher-driven cache layer behind the matcher (TS service, schema
      // snapshot, candidates, gen-map, match memo). The matcher's contract for
      // a field comes off the generator's moduleSelect declaration, read from
      // the (cached) describe descriptors.
      const state = new SourceState(root, viteRoot, options.project, {
        resolveModuleType: async generator => {
          if (generator === undefined) return undefined
          const result = await describe()
          return result.ok ? moduleTypeFromDescribe(result.data, generator) : undefined
        }
      })
      state.attach(server.watcher)

      const bundlePath = join(root, '.skmtc', options.project, 'bundle.js')
      const clientJsonFile = clientJsonPath(root, options.project)
      server.watcher.add(bundlePath)
      server.watcher.add(HARNESS_SOURCE_PATH)
      server.watcher.add(clientJsonFile)

      // The gen-map (`.maps/`) serves two consumers: `_map.ndjson` resolves a
      // model name to its generated file for the input matcher, and the
      // per-file span sidecars (`*.skm.json`) drive the code panel's
      // attribution overlay. Only `--anchors` generates emit them — and span
      // sidecars go stale on EVERY content change (spans shift), so every
      // generate path passes `--anchors` now (measured: the full reapit
      // generate with anchors is ~270 ms; the old "heavy, skip on edits"
      // assumption predates measurement). `genMapMissing` remains only as the
      // lazy bootstrap trigger for a project never generated with anchors.
      const genMapPath = join(root, '.skmtc', options.project, '.maps', '_map.ndjson')
      const genMapMissing = (): boolean => !existsSync(genMapPath)

      // describe is a function of the bundle AND the schema, so also invalidate
      // it when the local schema file changes (a URL source can't be watched).
      // `client.json#source` can itself move mid-session (the user repoints it),
      // so re-derive the watch whenever client.json changes, invalidating
      // describe only when the source ACTUALLY moved — an enrichment edit
      // rewrites client.json on every keystroke but leaves `source` alone.
      let schemaPath: string | null = null
      let watchedSource: string | null = null
      const refreshSchemaWatch = async (): Promise<void> => {
        const clientJson = await readClientJson(root, options.project).catch(() => null)
        if (!clientJson) return
        const source = typeof clientJson.source === 'string' ? clientJson.source : null
        if (source === watchedSource) return
        watchedSource = source
        if (schemaPath) server.watcher.unwatch(schemaPath)
        schemaPath = source && !/^https?:\/\//.test(source) ? join(root, source) : null
        if (schemaPath) server.watcher.add(schemaPath)
        describeCache = null
      }
      void refreshSchemaWatch()

      server.watcher.on('change', file => {
        if (file === bundlePath || file === schemaPath) describeCache = null
        if (file === clientJsonFile) void refreshSchemaWatch()
        // Harness source changed → invalidate its cached virtual module + reload.
        // Only the preview iframe carries `/@vite/client`, so this reloads the
        // iframe (re-importing the fresh harness), not the static editor SPA.
        if (file === HARNESS_SOURCE_PATH) {
          const harness = server.moduleGraph.getModuleById(HARNESS_RESOLVED_ID)
          if (harness) server.moduleGraph.invalidateModule(harness)
          server.ws.send({ type: 'full-reload' })
        }
      })

      // The providers resolution is baked into the harness's transformed import
      // at resolve time, so a providers file APPEARING or DISAPPEARING needs a
      // re-resolve: invalidate both modules and reload the iframe. (Edits to an
      // existing providers file are ordinary HMR and need nothing from us.)
      const providersFiles = new Set(PROVIDERS_CANDIDATES.map(name => join(viteRoot, 'src', name)))
      const onProvidersFileEvent = (file: string): void => {
        if (!providersFiles.has(file)) return
        for (const id of [PROVIDERS_RESOLVED_ID, HARNESS_RESOLVED_ID]) {
          const module = server.moduleGraph.getModuleById(id)
          if (module) server.moduleGraph.invalidateModule(module)
        }
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', onProvidersFileEvent)
      server.watcher.on('unlink', onProvidersFileEvent)

      // Read-only metadata: subjects + descriptors + defaults (cached).
      const describeHandler: Connect.NextHandleFunction = async (_request, response) => {
        const result = await describe()
        respondJson(
          response,
          result.ok ? 200 : 500,
          result.ok ? result.data : { error: result.message }
        )
      }

      // The on-disk client.json — the nested enrichment store the editor reads.
      const configHandler: Connect.NextHandleFunction = async (_request, response) => {
        try {
          respondJson(response, 200, await readClientJson(root, options.project))
        } catch (error) {
          respondJson(response, 500, { error: messageOf(error) })
        }
      }

      // Apply one enrichment edit → write client.json → regenerate. Serialized.
      const editHandler: Connect.NextHandleFunction = async (request, response) => {
        let edit
        try {
          edit = v.parse(enrichmentEditSchema, await readJsonBody(request))
        } catch (error) {
          respondJson(response, 400, { error: `invalid edit: ${messageOf(error)}` })
          return
        }
        const generate = await enqueue(async () => {
          const next = applyEditToClientJson(await readClientJson(root, options.project), edit)
          await writeClientJson(root, options.project, next)
          return runGenerate(root, options.project)
        }).catch((error): CliResult => ({ ok: false, code: 1, message: messageOf(error) }))
        // The generate rewrote the source the matcher type-checks against —
        // bump the state's file versions + drop its generate-derived caches.
        if (generate.ok) state.onGenerateSuccess()
        respondJson(response, generate.ok ? 200 : 500, { generate })
      }

      // Regenerate without an edit (initial render / manual refresh).
      const regenerateHandler: Connect.NextHandleFunction = async (_request, response) => {
        const generate = await enqueue(() => runGenerate(root, options.project))
        if (generate.ok) state.onGenerateSuccess()
        respondJson(response, generate.ok ? 200 : 500, { generate })
      }

      // Type-aware input matcher: adjudicate the picker candidates against the
      // field at the given schemaPath. Responds with a MatchOutcome — a named
      // verdict (fits / path-broken / model-missing / unavailable), never a
      // fallback list.
      const inputMatchesHandler: Connect.NextHandleFunction = async (request, response) => {
        let body
        try {
          body = v.parse(inputMatchesSchema, await readJsonBody(request))
        } catch (error) {
          respondJson(response, 400, { error: `invalid request: ${messageOf(error)}` })
          return
        }
        // The matcher needs the gen-map to resolve a model's import. If the
        // project was only ever generated without `--anchors`, bootstrap it once
        // now — lazily, on genuine picker use — so the field editor works from
        // first open without the user first hitting Regenerate. A plain
        // `vite dev` user who never opens the editor never triggers this.
        if (genMapMissing()) {
          const generate = await enqueue(() => runGenerate(root, options.project))
          if (generate.ok) state.onGenerateSuccess()
        }
        try {
          respondJson(response, 200, await state.match(body))
        } catch (error) {
          respondJson(response, 500, { error: messageOf(error) })
        }
      }

      // The renderable previews from the last generate manifest (module + subject).
      const previewsHandler: Connect.NextHandleFunction = async (_request, response) => {
        try {
          const clientJson = await readClientJson(root, options.project)
          const basePath = basePathOf(clientJson)
          respondJson(response, 200, await readPreviews(root, options.project, basePath))
        } catch (error) {
          respondJson(response, 500, { error: messageOf(error) })
        }
      }

      // The OpenAPI document (client.json#source) — for schemaPath resolution
      // in the editor. Served from the state's snapshot (refreshed on generate
      // or a local schema-file change), matching what the matcher checks against.
      const schemaHandler: Connect.NextHandleFunction = async (_request, response) => {
        try {
          const clientJson = await readClientJson(root, options.project)
          const source = clientJson.source
          if (typeof source !== 'string') {
            respondJson(response, 404, { error: 'client.json has no `source` schema reference' })
            return
          }
          respondJson(response, 200, await state.schemaDoc(source))
        } catch (error) {
          respondJson(response, 500, { error: messageOf(error) })
        }
      }

      // The project's input/field component source (client.json#settings.inputDirs)
      // — the type universe the matcher (Phase 11) compiles candidates against.
      const sourceHandler: Connect.NextHandleFunction = async (_request, response) => {
        try {
          const clientJson = await readClientJson(root, options.project)
          const inputDirs = Array.isArray(clientJson.settings.inputDirs)
            ? clientJson.settings.inputDirs.filter((dir): dir is string => typeof dir === 'string')
            : []
          respondJson(response, 200, { inputDirs, files: await readSource(root, inputDirs) })
        } catch (error) {
          respondJson(response, 500, { error: messageOf(error) })
        }
      }

      // The module-picker candidates: value exports from inputDirs (unfiltered;
      // the type-aware matcher adjudicates them per field). `filePath` is a
      // server-side detail — only the alias form goes over the wire.
      const candidatesHandler: Connect.NextHandleFunction = async (_request, response) => {
        try {
          const clientJson = await readClientJson(root, options.project)
          const inputDirs = Array.isArray(clientJson.settings.inputDirs)
            ? clientJson.settings.inputDirs.filter((dir): dir is string => typeof dir === 'string')
            : []
          const basePath = basePathOf(clientJson)
          const candidates = await state.candidates(inputDirs, basePath)
          respondJson(response, 200, {
            candidates: candidates.map(({ exportName, exportPath }) => ({
              exportName,
              exportPath
            }))
          })
        } catch (error) {
          respondJson(response, 500, { error: messageOf(error) })
        }
      }

      // The generated artifacts from the last generate manifest. Without a
      // `path` query: the file list (for the code view's tree). With one: that
      // file's contents — the path must be a manifest `files` key, so nothing
      // outside the last generate's output is readable.
      const artifactsHandler: Connect.NextHandleFunction = async (request, response) => {
        try {
          const path = new URL(request.url ?? '/', 'http://localhost').searchParams.get('path')
          if (path === null) {
            respondJson(response, 200, { files: await readArtifacts(root, options.project) })
            return
          }
          const content = await readArtifactContent(root, options.project, path)
          if (content === null) {
            respondJson(response, 404, { error: `not a generated file: ${path}` })
            return
          }
          respondJson(response, 200, { path, content })
        } catch (error) {
          respondJson(response, 500, { error: messageOf(error) })
        }
      }

      // The attribution gen-map from the last `--anchors` generate: every
      // sidecar span decoded to a flat entry (the hub's `GenMapEntry` shape,
      // plus `variant`), with formatter-drifted files reported as stale
      // instead of decorated wrongly. Drives the code panel's overlay.
      const genMapHandler: Connect.NextHandleFunction = async (_request, response) => {
        try {
          const clientJson = await readClientJson(root, options.project)
          const basePath = basePathOf(clientJson)
          respondJson(response, 200, await readGenMap(root, options.project, basePath))
        } catch (error) {
          respondJson(response, 500, { error: messageOf(error) })
        }
      }

      // The include/skip generator filters, edited FLAT (the hub's
      // `GeneratorFilter[]` rows). GET folds the on-disk nested form to rows;
      // POST folds rows back to the nested form, writes client.json and
      // regenerates. Serialized with the enrichment edits.
      const filtersReadHandler: Connect.NextHandleFunction = async (_request, response) => {
        try {
          const clientJson = await readClientJson(root, options.project)
          respondJson(response, 200, {
            include: fromFilterEntries(clientJson.settings.include),
            skip: fromFilterEntries(clientJson.settings.skip)
          })
        } catch (error) {
          respondJson(response, 500, { error: messageOf(error) })
        }
      }

      const filtersWriteHandler: Connect.NextHandleFunction = async (request, response) => {
        let filters
        try {
          filters = v.parse(filtersWriteSchema, await readJsonBody(request))
        } catch (error) {
          respondJson(response, 400, { error: `invalid filters: ${messageOf(error)}` })
          return
        }
        const generate = await enqueue(async () => {
          const clientJson = await readClientJson(root, options.project)
          await writeClientJson(root, options.project, {
            ...clientJson,
            settings: {
              ...clientJson.settings,
              include: toFilterEntries(filters.include),
              skip: toFilterEntries(filters.skip)
            }
          })
          return runGenerate(root, options.project)
        }).catch((error): CliResult => ({ ok: false, code: 1, message: messageOf(error) }))
        if (generate.ok) state.onGenerateSuccess()
        respondJson(response, generate.ok ? 200 : 500, { generate })
      }

      // Ungated handshake: hands the per-session token to a genuinely-local
      // caller (the desktop shell) so it needs no env var or handshake-file
      // access. `isLocalRequest` is the whole authorization — a tunnelled or
      // browser caller is refused. No CORS headers are set, so even a same-
      // machine browser page (which is already refused by the `origin` guard)
      // could not read the response body.
      const handshakeHandler: Connect.NextHandleFunction = (request, response) => {
        if (!isLocalRequest(request)) {
          respondJson(response, 403, { error: 'preview handshake is loopback-only' })
          return
        }
        respondJson(response, 200, { token: auth.token })
      }

      // The preview iframe document — served fully static; it imports the harness
      // (a virtual module the consumer's Vite transforms) via a runtime dynamic
      // import and inlines the HMR preambles itself (see IFRAME_HTML).
      const previewHtmlHandler: Connect.NextHandleFunction = (_request, response) => {
        response.statusCode = 200
        response.setHeader('content-type', 'text/html')
        response.end(IFRAME_HTML)
      }

      // Token-gated: metadata reads leak the project's schema + source, and the
      // mutating routes write client.json / spawn generate. `requireToken` wraps
      // the handler INSIDE `methodGuard`, so a wrong-method request still falls
      // through to the next middleware rather than 401-ing.
      const gated = (handler: Connect.NextHandleFunction): Connect.NextHandleFunction =>
        requireToken(auth.token, handler)
      server.middlewares.use('/__skmtc/describe', methodGuard('GET', gated(describeHandler)))
      server.middlewares.use('/__skmtc/config', methodGuard('GET', gated(configHandler)))
      server.middlewares.use('/__skmtc/previews', methodGuard('GET', gated(previewsHandler)))
      server.middlewares.use('/__skmtc/schema', methodGuard('GET', gated(schemaHandler)))
      server.middlewares.use('/__skmtc/source', methodGuard('GET', gated(sourceHandler)))
      server.middlewares.use('/__skmtc/candidates', methodGuard('GET', gated(candidatesHandler)))
      server.middlewares.use('/__skmtc/artifacts', methodGuard('GET', gated(artifactsHandler)))
      server.middlewares.use('/__skmtc/gen-map', methodGuard('GET', gated(genMapHandler)))
      server.middlewares.use('/__skmtc/filters', methodGuard('GET', gated(filtersReadHandler)))
      server.middlewares.use('/__skmtc/filters', methodGuard('POST', gated(filtersWriteHandler)))
      server.middlewares.use(
        '/__skmtc/input-matches',
        methodGuard('POST', gated(inputMatchesHandler))
      )
      server.middlewares.use('/__skmtc/edit', methodGuard('POST', gated(editHandler)))
      server.middlewares.use('/__skmtc/regenerate', methodGuard('POST', gated(regenerateHandler)))
      // Ungated: the handshake authorizes by loopback locality (see
      // `handshakeHandler`); the iframe bootstrap is loaded via iframe navigation
      // (which can't carry an Authorization header) and is static, non-sensitive
      // HTML — it calls no control route; the editor does that over fetch, with
      // the token.
      server.middlewares.use('/__skmtc/handshake', methodGuard('GET', handshakeHandler))
      server.middlewares.use('/__skmtc/preview', methodGuard('GET', previewHtmlHandler))
    }
  }
}
