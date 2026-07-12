// The local enrichment value-store: edit `client.json#settings.enrichments`
// (the nested tree the engine consumes) IN PLACE, addressed by subject identity.
//
// This is the local counterpart of apps/main's flat `EnrichmentSetting[]` model
// — but with no flat representation and, crucially, no operation-vs-model
// heuristic: the subject's `type` comes from `skmtc describe`, so we always know
// the exact address. The three shapes (valibot schema ≅ form UI ≅ this leaf) are
// structurally identical, so editing is pure positional read/write of a values
// leaf — there is no value mapping.
//
// Everything here is a pure, immutable function of its inputs (the tree is never
// mutated; a new tree is returned), so it unit-tests without a DOM or a bundle.

/** The canonical variant every variants-aware generator honours. Always present
 *  in the UI; the engine throws at start if other variants exist without it. */
export const MAIN_VARIANT = 'main'

/** Kebab-strict variant name, matching core's `variantNameRegex`. */
export const VARIANT_NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

/** A concrete generation subject — an operation (path + method) or a model. The
 *  `type` is authoritative (it comes from `describe`), so addressing never has to
 *  guess operation vs model from the tree shape. */
export type SubjectRef =
  | { type: 'operation'; path: string; method: string }
  | { type: 'model'; refName: string }

/** One enrichment values bag — opaque to the engine, keyed by the generator's
 *  descriptor field keys (plus any "drifted" keys an older schema left behind). */
export type Leaf = Record<string, unknown>

/** The nested `client.json#settings.enrichments` object. Loosely typed because
 *  its depth varies by subject type and reserved scope; navigated defensively. */
export type EnrichmentTree = Record<string, unknown>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

// --- Addressing -------------------------------------------------------------

/** Path to a subject's variant MAP — the node holding every variant's leaf. */
function subjectPath(generator: string, subject: SubjectRef): string[] {
  return subject.type === 'model'
    ? [generator, subject.refName]
    : [generator, subject.path, subject.method]
}

/** Path to one subject+variant leaf within the enrichments tree. */
export function leafPath(generator: string, subject: SubjectRef, variant: string): string[] {
  return [...subjectPath(generator, subject), variant]
}

/** Reserved address of a generator's run-constant (`generator`-scope) leaf. */
export const generatorScopePath = (generator: string): string[] => [generator, '_generator']

/** Reserved address of the stack-wide run-constant (`stack`-scope) leaf. */
export const stackScopePath = (): string[] => ['_stack']

// --- Immutable tree access by path ------------------------------------------

function getAt(tree: EnrichmentTree, path: string[]): unknown {
  let node: unknown = tree
  for (const key of path) {
    if (!isRecord(node)) return undefined
    node = node[key]
  }
  return node
}

/** Return a new tree with `value` set at `path`, creating intermediate objects. */
function setAt(tree: EnrichmentTree, path: string[], value: unknown): EnrichmentTree {
  const [head, ...rest] = path
  if (rest.length === 0) return { ...tree, [head]: value }
  const child = isRecord(tree[head]) ? tree[head] : {}
  return { ...tree, [head]: setAt(child, rest, value) }
}

/** Return a new tree with `path` removed, pruning ancestors it leaves empty. */
function deleteAt(tree: EnrichmentTree, path: string[]): EnrichmentTree {
  const [head, ...rest] = path
  if (rest.length === 0) {
    if (!(head in tree)) return tree
    const { [head]: _removed, ...remaining } = tree
    return remaining
  }
  const child = tree[head]
  if (!isRecord(child)) return tree
  const nextChild = deleteAt(child, rest)
  if (Object.keys(nextChild).length === 0) {
    const { [head]: _removed, ...remaining } = tree
    return remaining
  }
  return { ...tree, [head]: nextChild }
}

// --- Pure leaf helpers (store-agnostic) -------------------------------------

/**
 * Recursively drop `undefined` / empty-string leaves, empty objects, and empty
 * array items so an untouched field leaves no trace. Booleans / numbers (incl.
 * `false` / `0`) are kept; a toggle clears by emitting `undefined`, not `false`.
 */
export function cleanEnrichmentValues(value: unknown): unknown {
  if (value === undefined || value === '') return undefined
  if (Array.isArray(value)) {
    const items = value.map(cleanEnrichmentValues).filter(item => item !== undefined)
    return items.length > 0 ? items : undefined
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      const cleaned = cleanEnrichmentValues(entry)
      if (cleaned !== undefined) out[key] = cleaned
    }
    return Object.keys(out).length > 0 ? out : undefined
  }
  return value
}

/**
 * Merge a form bag into the stored leaf: the descriptor-controlled keys take the
 * form's (cleaned) value — absent/empty clears them — while any key the
 * descriptor does NOT control is preserved from the stored leaf. Returns
 * `undefined` when the merged leaf is empty. This is the preserve-don't-delete
 * rule: a value left over from an older schema survives an edit rather than being
 * silently pruned (the user discards drift explicitly).
 */
export function mergeDescribed(
  stored: Leaf,
  formValues: Leaf,
  describedKeys: string[]
): Leaf | undefined {
  const merged: Leaf = { ...stored }
  for (const key of describedKeys) {
    const cleaned = cleanEnrichmentValues(formValues[key])
    if (cleaned === undefined) delete merged[key]
    else merged[key] = cleaned
  }
  const cleaned = cleanEnrichmentValues(merged)
  return isRecord(cleaned) ? cleaned : undefined
}

// --- Reads ------------------------------------------------------------------

/** Variants for ONE subject: `main` first, then named variants present under the
 *  subject, de-duplicated and sorted. Variants are per-subject. */
export function listVariants(
  tree: EnrichmentTree,
  generator: string,
  subject: SubjectRef
): string[] {
  const node = getAt(tree, subjectPath(generator, subject))
  const named = isRecord(node) ? Object.keys(node).filter(key => key !== MAIN_VARIANT) : []
  return [MAIN_VARIANT, ...[...new Set(named)].sort((a, b) => a.localeCompare(b))]
}

/** The stored leaf for a subject + variant, or `{}` if none. */
export function readLeaf(
  tree: EnrichmentTree,
  generator: string,
  subject: SubjectRef,
  variant: string
): Leaf {
  const leaf = getAt(tree, leafPath(generator, subject, variant))
  return isRecord(leaf) ? leaf : {}
}

/** The stored `generator`-scope run-constant leaf, or `{}`. */
export function readGeneratorScope(tree: EnrichmentTree, generator: string): Leaf {
  const leaf = getAt(tree, generatorScopePath(generator))
  return isRecord(leaf) ? leaf : {}
}

/** The stored shared `stack`-scope run-constant leaf, or `{}`. */
export function readStackScope(tree: EnrichmentTree): Leaf {
  const leaf = getAt(tree, stackScopePath())
  return isRecord(leaf) ? leaf : {}
}

// --- Writes -----------------------------------------------------------------

function hasNamedVariants(tree: EnrichmentTree, generator: string, subject: SubjectRef): boolean {
  const node = getAt(tree, subjectPath(generator, subject))
  return isRecord(node) && Object.keys(node).some(key => key !== MAIN_VARIANT)
}

/**
 * Write a form bag into a subject + variant leaf (merge-preserving via
 * {@link mergeDescribed}). An emptied leaf drops, EXCEPT: an empty named variant
 * is kept (its existence is the declaration), and an empty `main` is kept as an
 * anchor while the subject still has named variants (the engine requires `main`
 * alongside them) — otherwise it drops.
 */
export function writeLeaf(
  tree: EnrichmentTree,
  generator: string,
  subject: SubjectRef,
  variant: string,
  formValues: Leaf,
  describedKeys: string[]
): EnrichmentTree {
  const path = leafPath(generator, subject, variant)
  const merged = mergeDescribed(
    readLeaf(tree, generator, subject, variant),
    formValues,
    describedKeys
  )
  if (merged) return setAt(tree, path, merged)
  if (variant !== MAIN_VARIANT) return setAt(tree, path, {})
  return hasNamedVariants(tree, generator, subject) ? setAt(tree, path, {}) : deleteAt(tree, path)
}

/** Write the `generator`-scope run-constant leaf (merge-preserving); drops when empty. */
export function writeGeneratorScope(
  tree: EnrichmentTree,
  generator: string,
  formValues: Leaf,
  describedKeys: string[]
): EnrichmentTree {
  const path = generatorScopePath(generator)
  const merged = mergeDescribed(readGeneratorScope(tree, generator), formValues, describedKeys)
  return merged ? setAt(tree, path, merged) : deleteAt(tree, path)
}

/** Write the shared `stack`-scope run-constant leaf (merge-preserving); drops when empty. */
export function writeStackScope(
  tree: EnrichmentTree,
  formValues: Leaf,
  describedKeys: string[]
): EnrichmentTree {
  const path = stackScopePath()
  const merged = mergeDescribed(readStackScope(tree), formValues, describedKeys)
  return merged ? setAt(tree, path, merged) : deleteAt(tree, path)
}

// --- Variant management -----------------------------------------------------

/** Materialise an empty named variant on a subject, ensuring `main` is anchored.
 *  `main` is always present and never materialised; existing leaves untouched. */
export function addVariant(
  tree: EnrichmentTree,
  generator: string,
  subject: SubjectRef,
  variant: string
): EnrichmentTree {
  if (variant === MAIN_VARIANT) return tree
  let next = tree
  const path = leafPath(generator, subject, variant)
  if (!isRecord(getAt(next, path))) next = setAt(next, path, {})
  const mainPath = leafPath(generator, subject, MAIN_VARIANT)
  if (!isRecord(getAt(next, mainPath))) next = setAt(next, mainPath, {})
  return next
}

/** Remove a named variant from a subject. `main` cannot be removed. If this drops
 *  the last named variant and `main` is empty, the subject prunes entirely. */
export function removeVariant(
  tree: EnrichmentTree,
  generator: string,
  subject: SubjectRef,
  variant: string
): EnrichmentTree {
  if (variant === MAIN_VARIANT) return tree
  const dropped = deleteAt(tree, leafPath(generator, subject, variant))
  if (hasNamedVariants(dropped, generator, subject)) return dropped
  const main = readLeaf(dropped, generator, subject, MAIN_VARIANT)
  return Object.keys(main).length === 0
    ? deleteAt(dropped, leafPath(generator, subject, MAIN_VARIANT))
    : dropped
}

/** Rename a named variant on a subject. `main` can't be the source or target. */
export function renameVariant(
  tree: EnrichmentTree,
  generator: string,
  subject: SubjectRef,
  fromVariant: string,
  toVariant: string
): EnrichmentTree {
  if (fromVariant === MAIN_VARIANT || toVariant === MAIN_VARIANT) return tree
  const leaf = getAt(tree, leafPath(generator, subject, fromVariant))
  if (!isRecord(leaf)) return tree
  return setAt(
    deleteAt(tree, leafPath(generator, subject, fromVariant)),
    leafPath(generator, subject, toVariant),
    leaf
  )
}

/** Validate a new variant name against the reserved word, format, and dupes. */
export function validateVariantName(name: string, existing: string[]): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Enter a variant name.'
  if (trimmed === MAIN_VARIANT) return '“main” is reserved and always present.'
  if (!VARIANT_NAME_REGEX.test(trimmed)) {
    return 'Use kebab-case: lowercase letters and digits, separated by single hyphens.'
  }
  if (existing.includes(trimmed)) return 'That variant already exists.'
  return null
}
