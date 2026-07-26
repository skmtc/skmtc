import type { PackageFacts, SingleDispatchResult } from '../types.ts'

/**
 * Check 16 — single dispatch (the generator skill's axiom 1). A
 * generator is a total mapping from IR nodes to producers, and the
 * `SchemaToValueFn` router is the ONLY place `schema.type` decides what
 * renders a node. The parse pass classifies every schema-type dispatch
 * site (a `switch` on `.type`, a `.type === '<schema type>'`
 * comparison) by where it sits:
 *
 * - `router`   — inside a `to*Value` / `schemaToValueFn` function or one
 *                annotated `SchemaToValueFn`: the sanctioned site.
 * - `metadata` — inside `toIdentifierType` / `isSupported`: mapping
 *                metadata (declaration kind, capability), not value
 *                dispatch.
 * - `outside`  — anywhere else: a third door. A projection reserving a
 *                type for itself, a value class switching on schema
 *                type while rendering — the road to broken.
 *
 * Docs: docs/single-dispatch.md
 */

export const runSingleDispatch = (facts: PackageFacts): SingleDispatchResult => {
  const sites = facts.files.flatMap(file => file.schemaDispatchSites)
  const outside = sites.filter(site => site.context === 'outside')

  return {
    pass: outside.length === 0,
    routerCount: sites.filter(site => site.context === 'router').length,
    metadataCount: sites.filter(site => site.context === 'metadata').length,
    outside
  }
}
