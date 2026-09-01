// Reader for `.maps/_map.ndjson` — the per-Definition reverse index the
// engine writes alongside the sidecars (one line per registered Definition:
// artifact file, definition name, generator id, schema pointer, variant).
// `skmtc explain ref` answers from this.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveAliasPath } from '@/lib/provenance/gen-map.ts'

export type GenerationMapEntry = {
  /** Manifest-keyed artifact path (basePath realigned). */
  artifactPath: string
  definitionName: string
  generatorId: string
  schemaPointer: string
  variant: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const toEntry = (value: unknown, basePath: string): GenerationMapEntry | undefined => {
  if (!isRecord(value)) return undefined
  const { f, name, g, s, v } = value
  if (typeof f !== 'string' || typeof name !== 'string') return undefined
  return {
    artifactPath: resolveAliasPath(f, basePath),
    definitionName: name,
    generatorId: typeof g === 'string' ? g : '',
    schemaPointer: typeof s === 'string' ? s : '',
    variant: typeof v === 'string' && v !== '' ? v : 'main'
  }
}

/** `[]` when the project has never generated with `--anchors`. Malformed
 *  lines are skipped, never thrown on. */
export const readGenerationMap = async (
  root: string,
  project: string,
  basePath: string
): Promise<GenerationMapEntry[]> => {
  let text: string
  try {
    text = await readFile(join(root, '.skmtc', project, '.maps', '_map.ndjson'), 'utf8')
  } catch {
    return []
  }
  return text
    .split('\n')
    .filter(line => line.trim() !== '')
    .flatMap(line => {
      try {
        const entry = toEntry(JSON.parse(line), basePath)
        return entry === undefined ? [] : [entry]
      } catch {
        return []
      }
    })
}
