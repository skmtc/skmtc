// Flat `GeneratorFilter` rows ↔ the nested `client.json` include/skip form.
//
// The engine wants the nested shape:
//
//   include/skip: Array<string | { [gen]: { [path]: { [method]: variant[] } } }
//                              | { [gen]: { [refName]: variant[] } }>
//
// while the editor UI (the rule tree ported from the hub) edits flat,
// table-shaped rows. These converters are a port of the pure parts of
// apps/service/src/lib/client-settings.ts (`toFilterEntries` /
// `fromFilterEntries`), typed locally so the plugin has no dependency on the
// hub's generated models.

import { match } from 'ts-pattern'
import * as v from 'valibot'

export const httpMethodSchema = v.picklist([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
  'trace'
])
export type HttpMethod = v.InferOutput<typeof httpMethodSchema>

/** One flat include/skip rule, validated at the HTTP boundary. */
export const generatorFilterSchema = v.variant('scope', [
  v.object({ scope: v.literal('all'), generator: v.string(), variants: v.array(v.string()) }),
  v.object({
    scope: v.literal('operation'),
    generator: v.string(),
    path: v.string(),
    method: httpMethodSchema,
    variants: v.array(v.string())
  }),
  v.object({
    scope: v.literal('model'),
    generator: v.string(),
    refName: v.string(),
    variants: v.array(v.string())
  })
])
export type GeneratorFilter = v.InferOutput<typeof generatorFilterSchema>

/** Body of `POST /__skmtc/filters`: the full flat include + skip lists. */
export const filtersWriteSchema = v.object({
  include: v.array(generatorFilterSchema),
  skip: v.array(generatorFilterSchema)
})
export type FiltersWrite = v.InferOutput<typeof filtersWriteSchema>

type OperationVariants = Record<string, Record<string, string[]>>
type ModelVariants = Record<string, string[]>

/** One entry of the nested include/skip array. */
export type FilterEntry = string | Record<string, OperationVariants | ModelVariants>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * Fold flat rules into the nested include/skip array. A whole-generator rule
 * (`scope: all`) becomes a bare string; operation and model rules merge per
 * generator into a single `{ [gen]: {...} }` entry (a generator is one kind,
 * so its rows are uniformly operation- or model-shaped).
 */
export function toFilterEntries(filters: GeneratorFilter[]): FilterEntry[] {
  const wholeGenerators: string[] = []
  const operations: Record<string, OperationVariants> = {}
  const models: Record<string, ModelVariants> = {}

  for (const filter of filters) {
    match(filter)
      .with({ scope: 'all' }, rule => {
        wholeGenerators.push(rule.generator)
      })
      .with({ scope: 'operation' }, rule => {
        const paths = (operations[rule.generator] ??= {})
        const methods = (paths[rule.path] ??= {})
        methods[rule.method] = rule.variants
      })
      .with({ scope: 'model' }, rule => {
        const refs = (models[rule.generator] ??= {})
        refs[rule.refName] = rule.variants
      })
      .exhaustive()
  }

  return [
    ...wholeGenerators,
    ...Object.entries(operations).map(([generator, paths]) => ({ [generator]: paths })),
    ...Object.entries(models).map(([generator, refs]) => ({ [generator]: refs }))
  ]
}

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

/**
 * Inverse of {@link toFilterEntries}: fold a nested include/skip array back
 * into flat rows. Mirrors the three entry shapes — bare-string whole-generator
 * (`all`), per-operation map (`path -> method -> variant[]`), and per-model
 * map (`refName -> variant[]`) — telling operation from model by the value
 * shape (a method map is an object; a model's variant list is an array).
 * Malformed nodes are skipped.
 */
export function fromFilterEntries(raw: unknown): GeneratorFilter[] {
  if (!Array.isArray(raw)) return []

  const rows: GeneratorFilter[] = []

  for (const entry of raw) {
    if (typeof entry === 'string') {
      rows.push({ generator: entry, scope: 'all', variants: [] })
      continue
    }
    if (!isRecord(entry)) continue

    for (const [generator, subjects] of Object.entries(entry)) {
      if (!isRecord(subjects)) continue
      for (const [subjectKey, value] of Object.entries(subjects)) {
        // Per-model: `refName -> variant[]`.
        if (Array.isArray(value)) {
          rows.push({
            generator,
            scope: 'model',
            refName: subjectKey,
            variants: toStringArray(value)
          })
          continue
        }
        // Per-operation: `path -> method -> variant[]`.
        if (!isRecord(value)) continue
        for (const [methodKey, variants] of Object.entries(value)) {
          const method = v.safeParse(httpMethodSchema, methodKey)
          if (!method.success) continue
          rows.push({
            generator,
            scope: 'operation',
            path: subjectKey,
            method: method.output,
            variants: toStringArray(variants)
          })
        }
      }
    }
  }

  return rows
}
