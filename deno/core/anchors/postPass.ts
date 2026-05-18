/**
 * @fileoverview Tie the Phase B + C pieces together: render a File,
 * walk the producer tree, AST-resolve each span's landmark + path,
 * build the sidecar.
 *
 * Pure function over its inputs — no I/O, no global state, no
 * pipeline hooks. The natural caller is `toArtifacts.ts` running
 * this once per File when `context.attribution?.enabled`. The CLI
 * (Phase D) handles disk writes via a separate `writeSidecar` wrapper.
 */

import type { File } from '@/dsl/File.ts'
import type { ParserAdapter } from './ParserAdapter.ts'
import type { RegistryEntry } from './sidecar.ts'
import type { Sidecar } from './sidecar.ts'
import type { Attribution } from './types.ts'
import { resolveSpansForFile } from './resolveSpans.ts'
import { attribute } from './attribute.ts'
import { buildSidecar, type ResolvedAnchor } from './buildSidecar.ts'

/**
 * Lookup contract for per-generator metadata. Phase D's CLI builds
 * this once from the project's lockfile + `deno.json` import map and
 * passes it in. Generators not in the map fall back to `version: ''`
 * + `registry: { host: 'jsr.io', kind: 'jsr' }` — the sidecar still
 * builds, just with degraded provenance.
 */
export type GeneratorMetaLookup = (genId: string) => {
  version: string
  registry: RegistryEntry
}

const defaultLookup: GeneratorMetaLookup = () => ({
  version: '',
  registry: { host: 'jsr.io', kind: 'jsr' }
})

export type PostPassArgs = {
  /** The rendered File whose Definitions have been instrumented. */
  file: File
  /**
   * The schema source name (e.g. `'openapi.json'`). Carried on the
   * sidecar's `src` field so re-anchor consumers know which schema
   * the producer ran against.
   */
  schemaSrc: string
  /** Parser adapter to resolve landmarks + paths. */
  parser: ParserAdapter
  /**
   * Per-generator metadata lookup. Defaults to a stub that fills
   * generator entries with empty version + `jsr.io` registry. The
   * Phase D CLI wires in a real lookup.
   */
  generatorMeta?: GeneratorMetaLookup
}

/**
 * Run the post-render attribution pass on a File and return the
 * Sidecar. Workflow:
 *
 *  1. `resolveSpansForFile(file)` — Phase B (§3.3): walks the
 *     instrumented producer tree.
 *  2. `attribute(span.producer)` — Phase B (§3.2): derives
 *     `{ genId, srcPtr, variant, defName }` from `generatorKey`.
 *  3. Parser ascends each span to its enclosing landmark; the
 *     `forEachChild`-indexed path is what makes the sidecar
 *     re-anchorable after a formatter pass.
 *  4. `buildSidecar(...)` — Phase C (§4.1): pool + intern, emit the
 *     Sidecar v2 object.
 *
 * Returns the Sidecar; caller decides what to do with it (write to
 * disk, attach to manifest, send over the wire).
 */
export const postPass = ({
  file,
  schemaSrc,
  parser,
  generatorMeta = defaultLookup
}: PostPassArgs): Sidecar => {
  const source = file.toString()
  const spans = resolveSpansForFile(file)
  const parsedFile = parser.parse(file.path, source)
  const landmarks = parser.collectLandmarks(parsedFile)

  const anchors: ResolvedAnchor[] = []
  for (const span of spans) {
    const attr: Attribution = attribute(span.producer)
    const node = parser.smallestEnclosing(parsedFile, span.from, span.to)
    const { landmark, path } = parser.ascendToLandmark(node, landmarks)
    const meta = generatorMeta(attr.genId)
    anchors.push({
      span,
      attribution: attr,
      landmark,
      path,
      generatorVersion: meta.version,
      registry: meta.registry
    })
  }

  return buildSidecar({
    filePath: file.path,
    schemaSrc,
    parser: parser.id,
    anchors
  })
}
