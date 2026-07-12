// Server-side type-aware input matcher. Decides which input/field components
// (each accepting a `lens: Lens<T>`) can bind to a given form field, by running
// the project's OWN TypeScript over a synthesised probe file. No browser, no
// ATA, no OAS→TS synthesis: field types are read as indexed-access on the
// generated model type, candidate types from the real component props, and the
// project's compiler decides assignability.
//
// The probe gives every question its own line, so a diagnostic's LINE is its
// classification: model import → model-missing; module-type source → unavailable;
// segment alias → path-broken at exactly that segment; a candidate's import →
// that candidate unresolved; a candidate's cell → that candidate misfits.
// There is no fallback list: every outcome is a named verdict (`MatchOutcome`).

import { join, relative } from 'node:path'
import { match, P } from 'ts-pattern'
import type * as TS from 'typescript'
import type { MatcherCandidate, MatchOutcome, MisfitCandidate, MisfitReason } from './wire.ts'

// The wire shapes (MatchOutcome, misfit reasons, candidates) are defined ONCE
// as valibot schemas in wire.ts — shared with the desktop via the
// `@skmtc/vite/wire` subpath — and re-exported here for in-package consumers.
export type { MatcherCandidate, MatchOutcome, MisfitCandidate, MisfitReason } from './wire.ts'

export type MatcherSubject =
  | { type: 'operation'; path: string; method: string }
  | { type: 'model'; refName: string }

/** A candidate plus the root-relative on-disk path the walker found it at —
 *  the probe imports by `filePath` (relative, alias-free). */
export type MatcherCandidateSource = MatcherCandidate & { filePath: string }

type Doc = Record<string, unknown>

const isRecord = (value: unknown): value is Doc =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

// --- OAS: resolve the field's root model NAME (not a synthesised type) --------

const refNameOf = (schema: unknown): string | undefined =>
  isRecord(schema) && typeof schema.$ref === 'string' ? schema.$ref.split('/').pop() : undefined

const operationAt = (doc: Doc, path: string, method: string): Doc | undefined => {
  const paths = isRecord(doc.paths) ? doc.paths : undefined
  const item = paths && isRecord(paths[path]) ? paths[path] : undefined
  const operation = item?.[method.toLowerCase()]
  return isRecord(operation) ? operation : undefined
}

const firstContentSchema = (content: unknown): unknown => {
  if (!isRecord(content)) return undefined
  const entry = Object.values(content).find(isRecord)
  return isRecord(entry) && isRecord(entry.schema) ? entry.schema : undefined
}

const requestBodyRoot = (operation: Doc): unknown => {
  if (Array.isArray(operation.parameters)) {
    const body = operation.parameters.find(p => isRecord(p) && p.in === 'body')
    if (isRecord(body) && isRecord(body.schema)) return body.schema // Swagger 2.0
  }
  if (isRecord(operation.requestBody)) return firstContentSchema(operation.requestBody.content) // OAS 3
  return undefined
}

// Follow a `$ref` chain to the dereferenced schema (or the input if inline).
const deref = (doc: Doc, schema: unknown, seen: Set<string> = new Set()): Doc | undefined => {
  if (!isRecord(schema)) return undefined
  const name = refNameOf(schema)
  if (name === undefined) return schema
  if (seen.has(name)) return undefined
  seen.add(name)
  const definitions = isRecord(doc.definitions) ? doc.definitions : undefined
  const components =
    isRecord(doc.components) && isRecord(doc.components.schemas)
      ? doc.components.schemas
      : undefined
  return deref(doc, definitions?.[name] ?? components?.[name], seen)
}

const successResponseSchema = (operation: Doc): unknown => {
  if (!isRecord(operation.responses)) return undefined
  const code =
    Object.keys(operation.responses).find(entry => /^2\d\d$/.test(entry)) ??
    (isRecord(operation.responses.default) ? 'default' : undefined)
  if (code === undefined) return undefined
  const response = operation.responses[code]
  if (!isRecord(response)) return undefined
  return isRecord(response.schema) ? response.schema : firstContentSchema(response.content)
}

/**
 * The generated model type NAME for a schemaPath root: the request-body model
 * (form `input` fields), the WHOLE success-response model (table/select fields),
 * or the model subject itself. `SuccessResponse` is NOT unwrapped to the row —
 * the schemaPath navigates into the list array explicitly (`_embedded` then an
 * `items` element step; see `renderProbe`), so it refers to the entire response
 * object, consistent with how `RequestBody` refers to the whole body. The
 * matcher then narrows by whatever module type the field's generator declares.
 */
export const rootModelNameForSchemaPath = (
  doc: Doc,
  subject: MatcherSubject,
  targetToken: string
): string | undefined =>
  match({ subject, targetToken })
    .with({ subject: { type: 'model' } }, ({ subject }) => subject.refName)
    .with({ subject: { type: 'operation' }, targetToken: 'RequestBody' }, ({ subject }) => {
      const operation = operationAt(doc, subject.path, subject.method)
      return operation ? refNameOf(requestBodyRoot(operation)) : undefined
    })
    .with({ subject: { type: 'operation' }, targetToken: 'SuccessResponse' }, ({ subject }) => {
      const operation = operationAt(doc, subject.path, subject.method)
      return operation ? refNameOf(successResponseSchema(operation)) : undefined
    })
    .otherwise(() => undefined)

// --- The probe ----------------------------------------------------------------

const stripExt = (path: string): string => path.replace(/\.(tsx?|jsx?)$/, '')

// A relative-import specifier from `fromDir` to `toFile` (both absolute), posix,
// always explicitly relative (`./…` or `../…`). The probe file lives at the Vite
// root while the model + candidate files are found under the skmtc root, so
// their absolute on-disk paths are re-based here onto the probe's location. In a
// single-package app fromDir === skmtcRoot and this reduces to the old
// `./<basePath-relative>` form.
export const toRelativeSpecifier = (fromDir: string, toFile: string): string => {
  const rel = relative(fromDir, toFile).split('\\').join('/')
  return rel.startsWith('.') ? rel : `./${rel}`
}

// Segments are interpolated into single-quoted index strings.
const escapeSegment = (segment: string): string =>
  segment.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

// The schemaPath segment that steps into an array's element — JSON Schema's own
// `items` keyword. A shared convention with the schema-path walker and the
// generators: object → property name, array → `items`.
const ARRAY_ITEM_SEGMENT = 'items'

// The built-in default contract (the common lens/input case), used when a
// subject's generator declares no moduleType (mirrors core's
// `lensInputModuleType`, self-contained so this package has no core dep).
const BUILTIN_MODULE_TYPE = `import type { Lens } from '@hookform/lenses'
type __SlotPrimitive = string | number | boolean | bigint | symbol | null | undefined | Date
type __SlotNormalize<T> = [T] extends [__SlotPrimitive] ? NonNullable<T> : T extends ReadonlyArray<infer U> ? Array<__SlotNormalize<U>> : { [K in keyof T]?: __SlotNormalize<NonNullable<T[K]>> }
export type InputModule<F> = (props: { lens: Lens<__SlotNormalize<F>> }) => unknown`

/**
 * The module-type SOURCE to inline into the probe + its exported type name.
 * The probe checks `typeof Candidate extends <ModuleType><FieldType>`; the
 * generator owns the binding contract by declaring it on its moduleSelect
 * field (read back off the describe descriptors). Each source declares
 * exactly one exported type — its name parses out.
 */
const moduleTypeHeader = (moduleType: string | undefined): { source: string; name: string } => {
  const source = moduleType ?? BUILTIN_MODULE_TYPE
  return { source, name: source.match(/export type (\w+)\s*</)?.[1] ?? 'InputModule' }
}

/** One probe candidate: the export name + the RELATIVE import path. */
export type ProbeCandidate = { exportName: string; importPath: string }

export type ProbeInput = {
  modelName: string
  /** Relative (`./src/…`) — never the consumer's `@/` alias. */
  modelImportPath: string
  moduleTypeSource: string
  moduleTypeName: string
  /** Property names under the root (the schemaPath minus its target token). */
  segments: string[]
  candidates: ProbeCandidate[]
}

/** The probe text plus the line index of every question it asks. */
export type ProbeLayout = {
  text: string
  modelLine: number
  moduleTypeStartLine: number
  moduleTypeEndLine: number
  segmentLines: number[]
  /** Offset of the `__F` alias name — where quickInfo reads the field type. */
  fieldTypeOffset: number
  importLines: number[]
  cellLines: number[]
  /** One direct-assignment line per candidate. Its diagnostic (if any) carries
   *  the WHY of a misfit as a structured message chain — the boolean cell line
   *  stays the adjudicator, these lines are only ever read for explanation. */
  explainLines: number[]
}

/**
 * Render the probe so every concern owns its own line and a diagnostic's line
 * classifies itself. The drill is a chain of type aliases, one per schemaPath
 * segment, `NonNullable`-wrapped past the first so optional intermediate
 * objects don't trip null-checks; each candidate gets one import line and one
 * cell line (`typeof C extends Slot<__F> ? true : false` assigned to `true`).
 */
export const renderProbe = (input: ProbeInput): ProbeLayout => {
  const { modelName, modelImportPath, moduleTypeSource, moduleTypeName, segments, candidates } =
    input
  const lines: string[] = []

  const modelLine = lines.length
  lines.push(`import type { ${modelName} } from '${modelImportPath}'`)

  const moduleTypeStartLine = lines.length
  lines.push(...moduleTypeSource.split('\n'))
  const moduleTypeEndLine = lines.length - 1

  const segmentLines: number[] = []
  segments.forEach((segment, index) => {
    segmentLines.push(lines.length)
    const base = index === 0 ? modelName : `NonNullable<__D${index - 1}>`
    // `items` steps into the array's element — OR, if a real object property is
    // literally named `items`, into that property (e.g. `/worksOrders/{id}`).
    // The fallback MUST be a structural `extends { items }` check, NOT an
    // indexed access `${base}['items']`: TS eagerly type-checks the non-taken
    // conditional branch, and `SomeArray['items']` is an error (arrays have no
    // `items`), which would break the common array case. `extends { items }`
    // resolves to `never` instead of erroring.
    lines.push(
      segment === ARRAY_ITEM_SEGMENT
        ? `type __D${index} = ${base} extends ReadonlyArray<infer __El${index}> ? __El${index} : ${base} extends { items: infer __It${index} } ? __It${index} : never`
        : `type __D${index} = ${base}['${escapeSegment(segment)}']`
    )
  })

  const fieldTypeLine = lines.length
  lines.push(`type __F = ${segments.length > 0 ? `__D${segments.length - 1}` : modelName}`)

  const importLines: number[] = []
  candidates.forEach((candidate, index) => {
    importLines.push(lines.length)
    lines.push(`import { ${candidate.exportName} as __C${index} } from '${candidate.importPath}'`)
  })

  const cellLines: number[] = []
  candidates.forEach((_, index) => {
    cellLines.push(lines.length)
    lines.push(
      `const __m${index}: true = (null as unknown as (typeof __C${index} extends ${moduleTypeName}<__F> ? true : false));`
    )
  })

  // The boolean cell above reduces assignability to `false is not assignable to
  // true` — correct for the verdict, useless as an explanation. A plain
  // assignment makes the compiler elaborate the REAL reason chain ("types of
  // property 'lens' are incompatible → …"), which `toMisfitReason` extracts.
  const explainLines: number[] = []
  candidates.forEach((_, index) => {
    explainLines.push(lines.length)
    lines.push(`const __e${index}: ${moduleTypeName}<__F> = __C${index};`)
  })

  lines.push('export {}')

  const fieldTypeLineStart = lines
    .slice(0, fieldTypeLine)
    .reduce((total, line) => total + line.length + 1, 0)
  return {
    text: lines.join('\n'),
    modelLine,
    moduleTypeStartLine,
    moduleTypeEndLine,
    segmentLines,
    fieldTypeOffset: fieldTypeLineStart + 'type '.length,
    importLines,
    cellLines,
    explainLines
  }
}

export type CandidateVerdict = 'fit' | 'misfit' | 'unresolved'

export type ProbeClassification =
  | { type: 'model-import-error' }
  | { type: 'module-type-error' }
  | { type: 'path-broken'; segmentIndex: number }
  | { type: 'verdicts'; verdicts: CandidateVerdict[] }

/**
 * Map the probe's error lines to a verdict, in strict precedence order: a
 * failed structural line (model import → module type → first broken segment) voids
 * everything downstream, so candidate lines are only read when the field type
 * actually resolved.
 */
export const classify = (
  errorLines: ReadonlySet<number>,
  layout: ProbeLayout
): ProbeClassification => {
  if (errorLines.has(layout.modelLine)) return { type: 'model-import-error' }
  for (let line = layout.moduleTypeStartLine; line <= layout.moduleTypeEndLine; line++) {
    if (errorLines.has(line)) return { type: 'module-type-error' }
  }
  const broken = layout.segmentLines.findIndex(line => errorLines.has(line))
  if (broken !== -1) return { type: 'path-broken', segmentIndex: broken }
  const verdicts = layout.importLines.map((importLine, index): CandidateVerdict => {
    if (errorLines.has(importLine)) return 'unresolved'
    return errorLines.has(layout.cellLines[index]) ? 'misfit' : 'fit'
  })
  return { type: 'verdicts', verdicts }
}

// --- Misfit reasons ---------------------------------------------------------------

const flattenChain = (chain: TS.DiagnosticMessageChain, into: string[]): void => {
  into.push(chain.messageText)
  chain.next?.forEach(next => flattenChain(next, into))
}

/**
 * Extract a `MisfitReason` from an explain-line diagnostic. The message chain
 * is walked as DATA (no `flattenDiagnosticMessageText` blob), and every
 * message is passed through `sanitize` so probe-internal names (`__C0`,
 * `__F`) never leak into user-facing text.
 */
export const toMisfitReason = (
  diagnostic: TS.Diagnostic,
  sanitize: (text: string) => string
): MisfitReason =>
  match(diagnostic.messageText)
    .returnType<MisfitReason>()
    .with(P.string, text => ({
      code: diagnostic.code,
      headline: sanitize(text),
      reasons: []
    }))
    .otherwise(chain => {
      const reasons: string[] = []
      chain.next?.forEach(next => flattenChain(next, reasons))
      return {
        code: diagnostic.code,
        headline: sanitize(chain.messageText),
        reasons: reasons.map(sanitize)
      }
    })

// --- The match ------------------------------------------------------------------

/** What the matcher needs from the (stateful) TypeScript service. */
export type MatcherService = {
  check: (probeContent: string) => readonly TS.Diagnostic[]
  /** Printed type at a probe offset (the `__F` alias), '' when unknown. */
  fieldTypeAt: (offset: number) => string
  fileExists: (path: string) => boolean
}

export type MatchArgs = {
  /** Anchors the on-disk model/candidate paths (both stored relative to it) —
   *  the repo root that holds `.skmtc/` in a monorepo. */
  skmtcRoot: string
  /** Anchors the probe's import specifiers — the Vite root where the probe file
   *  lives and its imports resolve. Equals `skmtcRoot` in a single-package app. */
  viteRoot: string
  basePath: string
  /** The OpenAPI / Swagger document (parsed). */
  schema: unknown
  subject: MatcherSubject
  /** Full schemaPath: a target token (`RequestBody`/`SuccessResponse`/`Model`)
   *  then property names. */
  schemaPath: string[]
  candidates: MatcherCandidateSource[]
  /** The moduleType contract (TS source) declared by the field's generator,
   *  read from the describe descriptors. Omit for the built-in lens/input
   *  default (generators that haven't adopted moduleSelect). */
  moduleType?: string
  /** Model type name → import path, from the gen-map (`skmtc generate
   *  --anchors`). The sole source of a model's import — a missing entry yields a
   *  `model-missing` outcome, never a guessed path. */
  modelImports: Map<string, string>
  service: MatcherService
}

const toWire = ({ exportName, exportPath }: MatcherCandidateSource): MatcherCandidate => ({
  exportName,
  exportPath
})

/**
 * Adjudicate `candidates` against the field at `schemaPath` and return a
 * `MatchOutcome`. One compiler pass answers every question: is the path valid
 * (and where does it break), does each candidate resolve, does each fit.
 */
export const matchInputs = (args: MatchArgs): MatchOutcome => {
  const { skmtcRoot, viteRoot, basePath, schema, subject, schemaPath, candidates, moduleType } =
    args
  const { modelImports, service } = args
  if (!isRecord(schema)) {
    return { type: 'unavailable', reason: 'The schema document could not be read.' }
  }
  if (schemaPath.length === 0) {
    return { type: 'unavailable', reason: 'The schemaPath is empty.' }
  }
  const [targetToken, ...segments] = schemaPath
  const modelName = rootModelNameForSchemaPath(schema, subject, targetToken)
  if (!modelName) {
    return {
      type: 'model-missing',
      modelName: null,
      detail: `No named model backs ${targetToken} for this subject — the schema may use an inline (unnamed) type.`
    }
  }

  // The model's import comes from the gen-map (`name → file`, from `skmtc
  // generate --anchors`) — the authoritative, convention-free source. We do NOT
  // guess a path: each project can lay out and name generated files differently,
  // so a guessed convention would resolve to the wrong file (or a phantom) and
  // silently mismatch. A miss is a real problem to diagnose, not to paper over.
  const alias = modelImports.get(modelName)
  if (alias === undefined) {
    return {
      type: 'model-missing',
      modelName,
      detail:
        modelImports.size === 0
          ? `No gen-map (.maps/_map.ndjson) to resolve the ${modelName} import — regenerate the project so its anchors are emitted.`
          : `The gen-map has no import entry for ${modelName} — it was not emitted by the last generate. Regenerate the project.`
    }
  }
  // The model + candidate files live under the skmtc root (their paths are
  // stored relative to it); the probe imports them by a specifier relative to
  // its own location at the Vite root, never the consumer's `@/` alias. On-disk
  // existence is checked at the skmtc-rooted absolute path; the import specifier
  // is re-based onto the Vite root.
  const modelRelativePath = (alias.startsWith('@/') ? join(basePath, alias.slice(2)) : alias)
    .split('\\')
    .join('/')
  const modelFileBase = join(skmtcRoot, modelRelativePath)
  if (!service.fileExists(`${modelFileBase}.ts`) && !service.fileExists(`${modelFileBase}.tsx`)) {
    return {
      type: 'model-missing',
      modelName,
      detail: `No generated file at ${modelRelativePath}.ts — regenerate the project.`
    }
  }

  const moduleTypePart = moduleTypeHeader(moduleType)
  const layout = renderProbe({
    modelName,
    modelImportPath: toRelativeSpecifier(viteRoot, modelFileBase),
    moduleTypeSource: moduleTypePart.source,
    moduleTypeName: moduleTypePart.name,
    segments,
    candidates: candidates.map(candidate => ({
      exportName: candidate.exportName,
      importPath: stripExt(toRelativeSpecifier(viteRoot, join(skmtcRoot, candidate.filePath)))
    }))
  })

  const errorLines = new Set<number>()
  // One diagnostic kept per line, for the explain-line reason extraction.
  // When a line carries several, prefer the failed assignment (TS2322) — it
  // holds the elaboration chain; whatever else shares the line does not.
  const ASSIGNMENT_ERROR = 2322
  const diagnosticAtLine = new Map<number, TS.Diagnostic>()
  for (const diagnostic of service.check(layout.text)) {
    if (diagnostic.start === undefined || !diagnostic.file) continue
    const line = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line
    errorLines.add(line)
    const kept = diagnosticAtLine.get(line)
    if (!kept || (kept.code !== ASSIGNMENT_ERROR && diagnostic.code === ASSIGNMENT_ERROR)) {
      diagnosticAtLine.set(line, diagnostic)
    }
  }

  return match(classify(errorLines, layout))
    .with(
      { type: 'model-import-error' },
      (): MatchOutcome => ({
        type: 'model-missing',
        modelName,
        detail: `${modelRelativePath} does not export ${modelName} — regenerate the project.`
      })
    )
    .with(
      { type: 'module-type-error' },
      (): MatchOutcome => ({
        type: 'unavailable',
        reason: `The ${moduleTypePart.name} module-type contract did not type-check against this project — its declared contract has an error, or a type it imports (for example the lens library) is not installed or resolvable here.`
      })
    )
    .with(
      { type: 'path-broken' },
      ({ segmentIndex }): MatchOutcome => ({
        type: 'path-broken',
        modelName,
        brokenAt: { index: segmentIndex, segment: segments[segmentIndex] }
      })
    )
    .with({ type: 'verdicts' }, ({ verdicts }): MatchOutcome => {
      const fieldType = service.fieldTypeAt(layout.fieldTypeOffset)
      // Probe-internal names must not leak into user-facing text: `__C<n>` is
      // the candidate's import alias, `__F` the field-type alias (it appears
      // inside the printed target, e.g. `InputModule<__F>`).
      const sanitize = (text: string): string =>
        text
          .replace(/__C(\d+)/g, (whole, digits: string) => {
            const name = candidates[Number(digits)]?.exportName
            return name ?? whole
          })
          .replace(/\b__F\b/g, fieldType === '' ? 'the field type' : fieldType)
      const misfitAt = (index: number): MisfitCandidate => {
        const diagnostic = diagnosticAtLine.get(layout.explainLines[index])
        const wire = toWire(candidates[index])
        return diagnostic ? { ...wire, reason: toMisfitReason(diagnostic, sanitize) } : wire
      }
      return {
        type: 'fits',
        fieldType,
        fits: candidates.filter((_, index) => verdicts[index] === 'fit').map(toWire),
        misfits: verdicts.flatMap((verdict, index) =>
          verdict === 'misfit' ? [misfitAt(index)] : []
        ),
        unresolved: candidates.filter((_, index) => verdicts[index] === 'unresolved').map(toWire)
      }
    })
    .exhaustive()
}
