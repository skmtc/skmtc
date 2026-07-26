import * as v from 'valibot'

/**
 * Valibot schema for root-level deno.json configuration files.
 *
 * Validates workspace-level deno.json files that manage multiple packages
 * and define workspace-wide imports and exports.
 */
export const rootDenoJson: v.GenericSchema<RootDenoJson> = v.looseObject({
  imports: v.optional(v.record(v.string(), v.string())),
  exports: v.optional(v.record(v.string(), v.string())),
  workspace: v.optional(v.array(v.string()))
})

/**
 * Type definition for root-level deno.json configuration.
 *
 * Represents the structure of workspace-level deno.json files that coordinate
 * multiple packages within a Deno workspace.
 */
export type RootDenoJson = {
  imports?: Record<string, string>
  exports?: Record<string, string>
  workspace?: string[]
}

/**
 * Valibot schema for package-level deno.json configuration files.
 *
 * Validates individual package deno.json files that define package-specific
 * metadata, dependencies, and export configurations.
 */
export const packageDenoJson: v.GenericSchema<PackageDenoJson> = v.looseObject({
  name: v.string(),
  version: v.string(),
  imports: v.optional(v.record(v.string(), v.string())),
  exports: v.union([v.record(v.string(), v.string()), v.string()]),
  lint: v.optional(
    v.looseObject({
      plugins: v.optional(v.array(v.string())),
      rules: v.optional(v.looseObject({ exclude: v.optional(v.array(v.string())) }))
    })
  )
})

/**
 * Type definition for package-level deno.json configuration.
 *
 * Represents the structure of individual package deno.json files with
 * required name/version fields and optional import/export configurations.
 */
export type PackageDenoJson = {
  name: string
  version: string
  imports?: Record<string, string>
  exports: Record<string, string> | string
  lint?: {
    plugins?: string[]
    rules?: { exclude?: string[] }
  }
}
