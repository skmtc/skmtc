// Read/write the project's `client.json` and apply enrichment edits to it. The
// nested `settings.enrichments` tree is the single source of truth (no flat
// representation); an edit is a positional write via the enrichment-leaf
// adapter, validated at the boundary with zod.

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { match } from 'ts-pattern'
import { z } from 'zod'
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

const subjectRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('operation'), path: z.string(), method: z.string() }),
  z.object({ type: z.literal('model'), refName: z.string() })
])

/** Body of `POST /__skmtc/input-matches`: which inputs fit one field.
 *  `generator` scopes the slot-contract lookup to the generator whose module
 *  field is being edited (two generators can map the same subject). */
export const inputMatchesSchema = z.object({
  subject: subjectRefSchema,
  schemaPath: z.array(z.string()).min(1),
  generator: z.string().optional()
})
const valuesSchema = z.record(z.string(), z.unknown())
const describedKeysSchema = z.array(z.string())

/**
 * One enrichment edit, validated at the HTTP boundary. The shape mirrors the
 * enrichment-leaf adapter ops; `EnrichmentEdit` is inferred from this schema so
 * the validator is the single source of truth.
 */
export const enrichmentEditSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('writeLeaf'),
    generator: z.string(),
    subject: subjectRefSchema,
    variant: z.string(),
    values: valuesSchema,
    describedKeys: describedKeysSchema
  }),
  z.object({
    op: z.literal('writeGeneratorScope'),
    generator: z.string(),
    values: valuesSchema,
    describedKeys: describedKeysSchema
  }),
  z.object({
    op: z.literal('writeStackScope'),
    values: valuesSchema,
    describedKeys: describedKeysSchema
  }),
  z.object({
    op: z.literal('addVariant'),
    generator: z.string(),
    subject: subjectRefSchema,
    variant: z.string()
  }),
  z.object({
    op: z.literal('removeVariant'),
    generator: z.string(),
    subject: subjectRefSchema,
    variant: z.string()
  }),
  z.object({
    op: z.literal('renameVariant'),
    generator: z.string(),
    subject: subjectRefSchema,
    from: z.string(),
    to: z.string()
  })
])

export type EnrichmentEdit = z.infer<typeof enrichmentEditSchema>

/** Apply one edit to an enrichments tree — pure dispatch over the adapter. */
export function applyEdit(tree: EnrichmentTree, edit: EnrichmentEdit): EnrichmentTree {
  return match(edit)
    .with({ op: 'writeLeaf' }, (e) =>
      writeLeaf(tree, e.generator, e.subject, e.variant, e.values, e.describedKeys)
    )
    .with({ op: 'writeGeneratorScope' }, (e) =>
      writeGeneratorScope(tree, e.generator, e.values, e.describedKeys)
    )
    .with({ op: 'writeStackScope' }, (e) => writeStackScope(tree, e.values, e.describedKeys))
    .with({ op: 'addVariant' }, (e) => addVariant(tree, e.generator, e.subject, e.variant))
    .with({ op: 'removeVariant' }, (e) => removeVariant(tree, e.generator, e.subject, e.variant))
    .with({ op: 'renameVariant' }, (e) => renameVariant(tree, e.generator, e.subject, e.from, e.to))
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
