import * as v from 'valibot'

export const rootDenoJson: v.GenericSchema<RootDenoJson> = v.looseObject({
  imports: v.optional(v.record(v.string(), v.string())),
  exports: v.optional(v.record(v.string(), v.string())),
  workspace: v.optional(v.array(v.string()))
})

export type RootDenoJson = {
  imports?: Record<string, string>
  exports?: Record<string, string>
  workspace?: string[]
}

export const packageDenoJson: v.GenericSchema<PackageDenoJson> = v.looseObject({
  name: v.string(),
  version: v.string(),
  imports: v.optional(v.record(v.string(), v.string())),
  exports: v.union([v.record(v.string(), v.string()), v.string()])
})

export type PackageDenoJson = {
  name: string
  version: string
  imports?: Record<string, string>
  exports: Record<string, string> | string
}
