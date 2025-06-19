import * as v from 'valibot'

export const rootDenoJson = v.looseObject({
  imports: v.optional(v.record(v.string(), v.string())),
  exports: v.optional(v.record(v.string(), v.string())),
  workspace: v.optional(v.array(v.string()))
})

export type RootDenoJson = {
  imports?: Record<string, string>
  exports?: Record<string, string>
  workspace?: string[]
}
