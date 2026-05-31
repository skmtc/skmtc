/**
 * @fileoverview Derive an Attribution tuple from a producer.
 *
 * `attribute()` is a pure function over a `SnippetBase` — it reads
 * the producer's `generatorKey`, the producer's own `schemaPointer` (if
 * any), and the producer's `Definition`-shaped identifier (if applicable),
 * and returns the canonical
 * `{ generatorId, schemaPointer, variant, definitionName, producerName }`
 * tuple. Used by sidecar emission (Phase C) and the viewer (Phase E).
 *
 * `genVersion` is intentionally not populated here. The version → id
 * map is plumbed through Phase D when the CLI reads each entry's
 * `denoJson.version`; this layer stays pure.
 */

import {
  fromGeneratorKey,
  toGeneratorId,
  type GeneratorKeyObject
} from '@/dsl/GeneratorKeys.ts'
import { Definition } from '@/dsl/Definition.ts'
import type { SnippetBase } from '@/dsl/SnippetBase.ts'
import type { Attribution } from './types.ts'

/**
 * Derive the attribution tuple for a producer.
 *
 * Producers without a `generatorKey` (rare — only test doubles or
 * runtime-orphaned Snippets) get `generatorId: '<unknown>'` and inherit
 * `schemaPointer` from caller-supplied fallback.
 */
export const attribute = (producer: SnippetBase): Attribution => {
  const key = producer.generatorKey
  const parsed = key ? fromGeneratorKey(key) : undefined

  return {
    generatorId: key && parsed ? toGeneratorId(key) : '<unknown>',
    // The producer's own position wins when it has one; otherwise fall
    // back to the key-derived pointer. The string conversion happens
    // here, once — `StackTrail` is carried everywhere upstream.
    schemaPointer: producer.schemaPointer.isEmpty()
      ? schemaPointerFromKey(parsed)
      : producer.schemaPointer.toJsonPointer(),
    variant: parsed && 'variant' in parsed ? parsed.variant : 'main',
    definitionName: producer instanceof Definition ? producer.identifier.name : undefined,
    // The producer's class name — `var X = class extends …` still yields
    // `X.name === 'X'` via named evaluation, so this survives `deno bundle`
    // (as long as the bundle isn't minified / collision-renamed).
    producerName: producer.constructor.name
  }
}

/**
 * Compute a fallback schema pointer from the parsed generator key when
 * the producer has no position of its own (empty trail).
 *
 * Pointers are **protocol-agnostic** — no `oas:` / `gql:` prefix; the
 * protocol is a property of the run's input schema, not of each pointer.
 *
 * - OAS operation → `#/paths/<escaped-path>/<method>`
 * - GQL operation → `<rootKind>.<fieldName>`
 * - Model → `#/components/schemas/<refName>`
 * - Generator-only / no key → `''` (no schema location to point at)
 */
const schemaPointerFromKey = (parsed: GeneratorKeyObject | undefined): string => {
  if (!parsed) return ''
  switch (parsed.type) {
    case 'oasOperation':
      return `#/paths/${escapeJsonPointer(parsed.path)}/${parsed.method}`
    case 'gqlOperation':
      return `${parsed.rootKind}.${parsed.fieldName}`
    case 'model':
      return `#/components/schemas/${parsed.refName}`
    case 'generator-only':
      return ''
    default: {
      const _exhaustive: never = parsed
      throw new Error(`Unhandled generator key type: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

/**
 * RFC 6901 JSON Pointer segment escaping. `~` → `~0`, `/` → `~1`.
 * Order matters: escape `~` first so the `/` replacement doesn't
 * later mangle the `~1` produced by the `~` step.
 */
const escapeJsonPointer = (segment: string): string =>
  segment.replace(/~/g, '~0').replace(/\//g, '~1')
