// The per-project source-of-truth cache behind the matcher: one place that
// owns the project's TypeScript language service, the schema/candidates/gen-map
// reads, and a match memo — all kept fresh by EVENTS (the Vite dev server's
// file watcher + the post-generate hook), never by per-request re-reads and
// never by a global "drop everything" counter. Hand-edits to input components
// are visible on the next match; the schema document is a SNAPSHOT-AT-GENERATE
// (the matcher resolves names into the currently generated code, so a live
// refetch of a drifted remote schema would be wrong, not just slow).

import { createRequire } from 'node:module'
import { join, sep } from 'node:path'
import type * as TS from 'typescript'
import { readClientJson } from './client-json.ts'
import {
  matchInputs,
  type MatcherService,
  type MatcherSubject,
  type MatchOutcome
} from './input-matcher.ts'
import { readModelImports } from './manifest.ts'
import { readCandidates, readSchema, type Candidate } from './project-sources.ts'

export type MatchRequest = {
  subject: MatcherSubject
  schemaPath: string[]
  generator?: string
}

export type SourceStateOptions = {
  /** The moduleType contract declared by a generator's moduleSelect field —
   *  the plugin resolves it off the (cached) describe descriptors. Absent /
   *  undefined result → the matcher's built-in lens contract. */
  resolveModuleType?: (generator: string | undefined) => Promise<string | undefined>
}

/** The slice of Vite's chokidar watcher the state subscribes to. */
type WatcherLike = {
  add(path: string): unknown
  on(event: 'all', listener: (eventName: string, file: string) => void): unknown
}

const loadTs = (root: string): typeof TS => createRequire(join(root, 'package.json'))('typescript')

const readCompilerOptions = (ts: typeof TS, root: string): TS.CompilerOptions => {
  for (const name of ['tsconfig.app.json', 'tsconfig.json']) {
    const path = join(root, name)
    if (!ts.sys.fileExists(path)) continue
    const parsed = ts.getParsedCommandLineOfConfigFile(
      path,
      {},
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: () => {}
      }
    )
    if (parsed && Object.keys(parsed.options).length > 0) return parsed.options
  }
  return {}
}

export class SourceState {
  #root: string
  #project: string

  // File freshness for the language service: versions bumped by watcher events;
  // `#seenFiles` records the project files the service has actually read, so a
  // generate can bump them all as a belt against fs-event latency.
  #fileVersions = new Map<string, number>()
  #seenFiles = new Set<string>()

  #memo = new Map<string, MatchOutcome>()
  #schemaCache: { source: string; value: Promise<unknown> } | null = null
  #schemaFile: string | null = null
  #candidatesCache: { key: string; value: Promise<Candidate[]> } | null = null
  #inputDirPrefixes: string[] = []
  #modelImportsCache: Promise<Map<string, string>> | null = null
  #service: MatcherService | null = null
  #serviceError: string | null = null

  #resolveModuleType: SourceStateOptions['resolveModuleType']

  constructor(root: string, project: string, options: SourceStateOptions = {}) {
    this.#root = root
    this.#project = project
    this.#resolveModuleType = options.resolveModuleType
  }

  get #clientJsonPath(): string {
    return join(this.#root, '.skmtc', this.#project, '.settings', 'client.json')
  }
  get #mapsPath(): string {
    return join(this.#root, '.skmtc', this.#project, '.maps', '_map.ndjson')
  }

  /** Subscribe to the dev server's watcher; also watch the project's own
   *  `.skmtc/<project>` tree (manifest, gen-map, client.json). */
  attach(watcher: WatcherLike): void {
    watcher.add(join(this.#root, '.skmtc', this.#project))
    watcher.on('all', (_eventName, file) => this.#onFileEvent(file))
  }

  #onFileEvent(file: string): void {
    if (!file.startsWith(this.#root + sep)) return
    if (file.includes(`${sep}node_modules${sep}`) || file.includes(`${sep}.git${sep}`)) return
    this.#fileVersions.set(file, (this.#fileVersions.get(file) ?? 0) + 1)
    this.#memo.clear()
    if (file === this.#schemaFile) this.#schemaCache = null
    if (file === this.#mapsPath) this.#modelImportsCache = null
    if (
      file === this.#clientJsonPath ||
      this.#inputDirPrefixes.some((prefix) => file.startsWith(prefix))
    ) {
      this.#candidatesCache = null
    }
  }

  /** A generate rewrote source: bump every file the service has read (fs events
   *  may lag the HTTP response), and drop the generate-derived caches. */
  onGenerateSuccess(): void {
    for (const file of this.#seenFiles) {
      this.#fileVersions.set(file, (this.#fileVersions.get(file) ?? 0) + 1)
    }
    this.#schemaCache = null
    this.#modelImportsCache = null
    this.#memo.clear()
  }

  /** The schema document for `source` — snapshot semantics: cached until a
   *  generate succeeds (or, for a local file, until the file itself changes). */
  schemaDoc(source: string): Promise<unknown> {
    if (this.#schemaCache?.source === source) return this.#schemaCache.value
    this.#schemaFile = /^https?:\/\//.test(source) ? null : join(this.#root, source)
    const value = readSchema(this.#root, source)
    this.#schemaCache = { source, value }
    return value
  }

  /** The candidate exports from the project's inputDirs. Self-validating key
   *  (inputDirs + basePath), invalidated by watcher events under any inputDir. */
  candidates(inputDirs: string[], basePath: string): Promise<Candidate[]> {
    const key = JSON.stringify([inputDirs, basePath])
    this.#inputDirPrefixes = inputDirs.map((dir) => join(this.#root, dir) + sep)
    if (this.#candidatesCache?.key === key) return this.#candidatesCache.value
    const value = readCandidates(this.#root, inputDirs, basePath)
    this.#candidatesCache = { key, value }
    return value
  }

  modelImports(): Promise<Map<string, string>> {
    this.#modelImportsCache ??= readModelImports(this.#root, this.#project)
    return this.#modelImportsCache
  }

  #serviceOrThrow(): MatcherService {
    if (this.#serviceError !== null) throw new Error(this.#serviceError)
    if (this.#service) return this.#service
    try {
      this.#service = this.#createService()
    } catch (error) {
      this.#serviceError = `The project's TypeScript could not be loaded: ${
        error instanceof Error ? error.message : String(error)
      }`
      throw new Error(this.#serviceError, { cause: error })
    }
    return this.#service
  }

  #createService(): MatcherService {
    const root = this.#root
    const ts = loadTs(root)
    const options: TS.CompilerOptions = {
      ...readCompilerOptions(ts, root),
      // The probe's consts are unused by design; kill the lint noise so only real
      // type errors survive. skipLibCheck keeps the warm-up fast.
      noUnusedLocals: false,
      noUnusedParameters: false,
      noEmit: true,
      skipLibCheck: true
    }
    const probePath = join(root, '__skmtc_input_probe.tsx')
    let probeContent = ''
    let probeVersion = 0
    const nodeModulesMarker = `${sep}node_modules${sep}`
    const host: TS.LanguageServiceHost = {
      getScriptFileNames: () => [probePath],
      // The probe bumps per check; project files carry watcher-driven versions,
      // so a hand-edit to an input component is re-read on the next match.
      getScriptVersion: (file) =>
        file === probePath ? `p${probeVersion}` : String(this.#fileVersions.get(file) ?? 0),
      getScriptSnapshot: (file) => {
        if (file === probePath) return ts.ScriptSnapshot.fromString(probeContent)
        const text = ts.sys.readFile(file)
        if (text === undefined) return undefined
        if (file.startsWith(root + sep) && !file.includes(nodeModulesMarker)) {
          this.#seenFiles.add(file)
        }
        return ts.ScriptSnapshot.fromString(text)
      },
      getCurrentDirectory: () => root,
      getCompilationSettings: () => options,
      getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
      fileExists: (file) => (file === probePath ? true : ts.sys.fileExists(file)),
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories
    }
    const service = ts.createLanguageService(host, ts.createDocumentRegistry())
    return {
      check: (content) => {
        probeContent = content
        probeVersion++
        return service.getSemanticDiagnostics(probePath)
      },
      fieldTypeAt: (offset) => {
        const info = service.getQuickInfoAtPosition(probePath, offset)
        if (!info) return ''
        return ts.displayPartsToString(info.displayParts).replace(/^type __F = /, '')
      },
      fileExists: (file) => ts.sys.fileExists(file)
    }
  }

  /** Adjudicate one match request. Memoized until the next relevant file event
   *  or generate; transient read failures are NOT memoized. */
  async match(request: MatchRequest): Promise<MatchOutcome> {
    const key = JSON.stringify([request.subject, request.schemaPath, request.generator ?? null])
    const memoized = this.#memo.get(key)
    if (memoized) return memoized

    const clientJson = await readClientJson(this.#root, this.#project)
    const source = clientJson.source
    if (typeof source !== 'string') {
      return { type: 'unavailable', reason: 'client.json has no `source` schema reference.' }
    }
    const inputDirs = Array.isArray(clientJson.settings.inputDirs)
      ? clientJson.settings.inputDirs.filter((dir): dir is string => typeof dir === 'string')
      : []
    const basePath =
      typeof clientJson.settings.basePath === 'string' ? clientJson.settings.basePath : 'src'

    let outcome: MatchOutcome
    try {
      const [schema, candidates, moduleType, modelImports] = await Promise.all([
        this.schemaDoc(source),
        this.candidates(inputDirs, basePath),
        this.#resolveModuleType?.(request.generator) ?? Promise.resolve(undefined),
        this.modelImports()
      ])
      outcome = matchInputs({
        root: this.#root,
        basePath,
        schema,
        subject: request.subject,
        schemaPath: request.schemaPath,
        candidates,
        moduleType,
        modelImports,
        service: this.#serviceOrThrow()
      })
    } catch (error) {
      // Transient (schema fetch, fs) — report but don't memoize, so a retry
      // after the cause clears succeeds.
      return {
        type: 'unavailable',
        reason: error instanceof Error ? error.message : String(error)
      }
    }
    this.#memo.set(key, outcome)
    return outcome
  }
}
