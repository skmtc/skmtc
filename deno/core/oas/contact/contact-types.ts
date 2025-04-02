import * as v from 'valibot'

export type OasContactData = {
  oasType: 'contact'
  name?: string
  url?: string
  email?: string
}

export const oasContactData = v.object({
  oasType: v.literal('contact'),
  name: v.optional(v.string()),
  url: v.optional(v.string()),
  email: v.optional(v.string())
})
