/**
 * The seed enrichment values each generator derives from a document — the
 * "Generate fields from schema" payload the CMS persists and the user then
 * edits.
 *
 * Produced by calling every generator's `toEnrichmentDefaults` over the parsed
 * document's supported operations / models (the subject-scope leaf of the
 * returned umbrella). Unlike {@link SupportedSubjects} this is the *values*, not
 * the capability set: only generators that advertise `toEnrichmentDefaults`
 * appear, and only the subjects for which a non-`undefined` default is computed.
 *
 * The shape mirrors the `client.json#settings.enrichments` subtree so a host
 * can fold it straight into settings (subject scope only — the run-constant
 * `_generator` / `_stack` scopes are out of scope for seeding):
 *  - operation generator: `[id][path][method][variant] = values`
 *  - model generator:     `[id][refName][variant] = values`
 *
 * `variant` is always `'main'` — seeding targets the default variant; existing
 * named variants keep their own authored values.
 */

/** A subject's default enrichment leaf — opaque to the engine (the generator's
 *  subject-scope enrichment values, e.g. `{ fields, title }`). */
export type EnrichmentDefaultsLeaf = Record<string, unknown>

/** Operation generator defaults: `path -> method -> variant -> leaf`. */
export type OperationEnrichmentDefaults = Record<
  string,
  Record<string, Record<string, EnrichmentDefaultsLeaf>>
>

/** Model generator defaults: `refName -> variant -> leaf`. */
export type ModelEnrichmentDefaults = Record<string, Record<string, EnrichmentDefaultsLeaf>>

/** Generator id → the default enrichment values that generator seeds. */
export type EnrichmentDefaults = Record<
  string,
  OperationEnrichmentDefaults | ModelEnrichmentDefaults
>
