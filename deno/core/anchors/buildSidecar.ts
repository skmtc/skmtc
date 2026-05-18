/**
 * @fileoverview Assemble a {@link Sidecar} from resolved spans +
 * attributions + landmark/path pairs.
 *
 * Pure function: no I/O, no parser, no global state. The AST landmark
 * resolution step (plan §4.2) is *not* done here — the caller passes
 * pre-resolved `(landmark, path)` pairs alongside each span. This
 * separation is deliberate:
 *
 * - The sidecar shape + interning logic can be tested without a
 *   parser (`FakeParser` is enough).
 * - When tsc / oxc adapters land (plan §8), they're swap-ins behind
 *   the `ParserAdapter` interface — no churn here.
 *
 * `writeSidecar` (Phase D) is the thin I/O wrapper. It stays separate
 * so the pure builder can be exercised independently with a temp dir.
 */

import type { Span, Attribution } from './types.ts'
import {
  emptySidecar,
  type Sidecar,
  type RegistryEntry,
  type GeneratorEntry
} from './sidecar.ts'

/**
 * One (span, attribution, landmark) triple — the input unit for
 * `buildSidecar`. `landmark` is the top-level export name the span
 * lives under (empty string when the span sits outside any landmark,
 * which the builder treats as a skip). `path` is the AST child-index
 * trail inside the landmark; empty path means "the landmark itself".
 */
export type ResolvedAnchor = {
  span: Span
  attribution: Attribution
  landmark: string
  path: number[]
  /**
   * Generator metadata for the producer that owns this span. The
   * `attribute()` step gives us only the generator id; the version +
   * registry come from the CLI's view of `deno.json`/lockfile (Phase
   * D plumbs this). For now callers pass it in; the builder takes
   * whatever they hand over and pools it.
   */
  generatorVersion: string
  registry: RegistryEntry
}

export type BuildSidecarArgs = {
  filePath: string
  schemaSrc: string
  parser: string
  anchors: ResolvedAnchor[]
}

/**
 * Assemble a Sidecar v2 from resolved anchors. Anchors with an empty
 * `landmark` string are skipped — they sit outside any top-level
 * export and have no useful re-resolution path (plan #25).
 */
export const buildSidecar = ({
  filePath,
  schemaSrc,
  parser,
  anchors
}: BuildSidecarArgs): Sidecar => {
  const sidecar = emptySidecar(filePath, schemaSrc, parser)
  // String-pool interning. Repeated values get the same index.
  const stringPool = (pool: string[]) => {
    const cache = new Map<string, number>()
    return (value: string): number => {
      const hit = cache.get(value)
      if (hit !== undefined) return hit
      const idx = pool.length
      pool.push(value)
      cache.set(value, idx)
      return idx
    }
  }
  // Object pools key on a canonical string form so we don't double-
  // intern entries that happen to be structurally equal but
  // referentially distinct.
  const internRegistry = (() => {
    const cache = new Map<string, number>()
    return (entry: RegistryEntry): number => {
      const key = `${entry.kind}|${entry.host}`
      const hit = cache.get(key)
      if (hit !== undefined) return hit
      const idx = sidecar.R.length
      sidecar.R.push(entry)
      cache.set(key, idx)
      return idx
    }
  })()
  const internGenerator = (() => {
    const cache = new Map<string, number>()
    return (entry: GeneratorEntry): number => {
      const key = `${entry.name}|${entry.version}|${entry.r}`
      const hit = cache.get(key)
      if (hit !== undefined) return hit
      const idx = sidecar.G.length
      sidecar.G.push(entry)
      cache.set(key, idx)
      return idx
    }
  })()

  const internS = stringPool(sidecar.S)
  const internV = stringPool(sidecar.V)
  const internL = stringPool(sidecar.L)
  const internP = stringPool(sidecar.P)

  for (const anchor of anchors) {
    if (anchor.landmark === '') {
      // Span outside any landmark. Skip — re-anchoring after
      // reformatting wouldn't have anything stable to descend from.
      continue
    }
    const ri = internRegistry(anchor.registry)
    const gi = internGenerator({
      name: anchor.attribution.genId,
      version: anchor.generatorVersion,
      r: ri
    })
    // Schema pointer may be undefined for generator-only producers;
    // we pool an empty string in that case so the A-row's `si`
    // remains a valid pool index. Consumers treat the empty pool
    // entry as "no schema pointer".
    const si = internS(anchor.attribution.srcPtr ?? '')
    const vi = internV(anchor.attribution.variant)
    const Li = internL(anchor.landmark)
    const Pi = internP(anchor.path.join('.'))
    sidecar.A.push([Li, Pi, gi, si, vi, anchor.span.from, anchor.span.to])
  }

  return sidecar
}
