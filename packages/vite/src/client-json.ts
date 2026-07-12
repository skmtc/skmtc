// Read/write the project's `client.json` and apply enrichment edits to it. The
// nested `settings.enrichments` tree is the single source of truth (no flat
// representation); an edit is a positional write via the enrichment-leaf
// adapter, validated at the boundary with valibot.

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { match } from 'ts-pattern'
import * as v from 'valibot'
import {
  addVariant,
  removeVariant,
  renameVariant,
  writeGeneratorScope,
  writeLeaf,
  writeStackScope,
  type EnrichmentTree
} from './enrichment-leaf.ts'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** The on-disk `client.json`. Loosely typed: the plugin owns only the
 *  `settings.enrichments` subtree; every other field passes through untouched. */
export type ClientJson = Record<string, unknown> & { settings: Record<string, unknown> }

/** The engine's own fallback when `settings.basePath` is absent (it is
 *  `v.optional` in `@skmtc/core` Settings): generated files land relative to
 *  the project root — `skmtc` cli `project-headless.ts` `basePath ?? "."`.
 *  Must stay identical, or path resolution here disagrees with where the
 *  engine actually wrote files. */
const ENGINE_DEFAULT_BASE_PATH = '.'

/** `settings.basePath`, with the engine's `'.'` fallback. `ClientJson` is
 *  deliberately loose (`settings` values are `unknown`), so the narrowing
 *  lives here rather than inline at every consumer. */
export const basePathOf = (clientJson: ClientJson): string =>
  typeof clientJson.settings.basePath === 'string'
    ? clientJson.settings.basePath
    : ENGINE_DEFAULT_BASE_PATH

const subjectRefSchema = v.variant('type', [
  v.object({ type: v.literal('operation'), path: v.string(), method: v.string() }),
  v.object({ type: v.literal('model'), refName: v.string() })
])

/** Body of `POST /__skmtc/input-matches`: which inputs fit one field.
 *  `generator` scopes the slot-contract lookup to the generator whose module
 *  field is being edited (two generators can map the same subject). */
export const inputMatchesSchema = v.object({
  subject: subjectRefSchema,
  schemaPath: v.pipe(v.array(v.string()), v.minLength(1)),
  generator: v.optional(v.string())
})
const valuesSchema = v.record(v.string(), v.unknown())
const describedKeysSchema = v.array(v.string())

/**
 * One enrichment edit, validated at the HTTP boundary. The shape mirrors the
 * enrichment-leaf adapter ops; `EnrichmentEdit` is inferred from this schema so
 * the validator is the single source of truth.
 */
export const enrichmentEditSchema = v.variant('op', [
  v.object({
    op: v.literal('writeLeaf'),
    generator: v.string(),
    subject: subjectRefSchema,
    variant: v.string(),
    values: valuesSchema,
    describedKeys: describedKeysSchema
  }),
  v.object({
    op: v.literal('writeGeneratorScope'),
    generator: v.string(),
    values: valuesSchema,
    describedKeys: describedKeysSchema
  }),
  v.object({
    op: v.literal('writeStackScope'),
    values: valuesSchema,
    describedKeys: describedKeysSchema
  }),
  v.object({
    op: v.literal('addVariant'),
    generator: v.string(),
    subject: subjectRefSchema,
    variant: v.string()
  }),
  v.object({
    op: v.literal('removeVariant'),
    generator: v.string(),
    subject: subjectRefSchema,
    variant: v.string()
  }),
  v.object({
    op: v.literal('renameVariant'),
    generator: v.string(),
    subject: subjectRefSchema,
    from: v.string(),
    to: v.string()
  })
])

export type EnrichmentEdit = v.InferOutput<typeof enrichmentEditSchema>

/** Apply one edit to an enrichments tree — pure dispatch over the adapter. */
export function applyEdit(tree: EnrichmentTree, edit: EnrichmentEdit): EnrichmentTree {
  return match(edit)
    .with({ op: 'writeLeaf' }, e =>
      writeLeaf(tree, e.generator, e.subject, e.variant, e.values, e.describedKeys)
    )
    .with({ op: 'writeGeneratorScope' }, e =>
      writeGeneratorScope(tree, e.generator, e.values, e.describedKeys)
    )
    .with({ op: 'writeStackScope' }, e => writeStackScope(tree, e.values, e.describedKeys))
    .with({ op: 'addVariant' }, e => addVariant(tree, e.generator, e.subject, e.variant))
    .with({ op: 'removeVariant' }, e => removeVariant(tree, e.generator, e.subject, e.variant))
    .with({ op: 'renameVariant' }, e => renameVariant(tree, e.generator, e.subject, e.from, e.to))
    .exhaustive()
}

/** Apply an edit to a whole `client.json`, returning a new one with the
 *  enrichments subtree updated and every other field preserved. */
export function applyEditToClientJson(clientJson: ClientJson, edit: EnrichmentEdit): ClientJson {
  const enrichments = isRecord(clientJson.settings.enrichments)
    ? clientJson.settings.enrichments
    : {}
  return {
    ...clientJson,
    settings: { ...clientJson.settings, enrichments: applyEdit(enrichments, edit) }
  }
}

export const clientJsonPath = (root: string, project: string): string =>
  join(root, '.skmtc', project, '.settings', 'client.json')

export async function readClientJson(root: string, project: string): Promise<ClientJson> {
  const text = await readFile(clientJsonPath(root, project), 'utf8')
  const parsed: unknown = JSON.parse(text)
  if (!isRecord(parsed)) throw new Error('client.json is not a JSON object')
  const settings = isRecord(parsed.settings) ? parsed.settings : {}
  return { ...parsed, settings }
}

export async function writeClientJson(
  root: string,
  project: string,
  clientJson: ClientJson
): Promise<void> {
  await writeFile(clientJsonPath(root, project), `${JSON.stringify(clientJson, null, 2)}\n`, 'utf8')
}
