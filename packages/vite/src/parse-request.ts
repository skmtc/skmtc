// Parse a request body against a valibot schema, throwing a message that
// names every failing field. `v.parse`'s ValiError.message is just the first
// issue's text (e.g. "Invalid type: Expected string but received undefined")
// with no indication of WHICH field — useless in a 400 for a nested edit
// payload. This collects all issues with their dot paths instead.

import * as v from 'valibot'

export const parseRequest = <TSchema extends v.GenericSchema>(
  schema: TSchema,
  input: unknown
): v.InferOutput<TSchema> => {
  const result = v.safeParse(schema, input)
  if (result.success) return result.output
  const details = result.issues
    .map(issue => {
      const path = v.getDotPath(issue)
      return path === null ? issue.message : `${path}: ${issue.message}`
    })
    .join('; ')
  throw new Error(details)
}
