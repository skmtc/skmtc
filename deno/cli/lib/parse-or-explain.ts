import * as v from 'valibot'

export class ConfigValidationError extends Error {
  readonly issues: ReadonlyArray<v.BaseIssue<unknown>>
  readonly context: string

  constructor(context: string, issues: ReadonlyArray<v.BaseIssue<unknown>>) {
    super(formatMessage(context, issues))
    this.name = 'ConfigValidationError'
    this.context = context
    this.issues = issues
  }
}

const formatIssue = (issue: v.BaseIssue<unknown>): string => {
  const path = v.getDotPath(issue) ?? '<root>'
  const lines = [`  - ${path}: ${issue.message}`]

  if (issue.expected !== null) {
    lines.push(`    expected: ${issue.expected}`)
  }
  lines.push(`    received: ${issue.received}`)

  return lines.join('\n')
}

const formatMessage = (context: string, issues: ReadonlyArray<v.BaseIssue<unknown>>): string => {
  const count = issues.length
  const header = `${context}: validation failed (${count} issue${count === 1 ? '' : 's'})`
  const body = issues.map(formatIssue).join('\n')

  return `${header}\n${body}`
}

type Schema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>

export const parseOrExplain = <TSchema extends Schema>(
  schema: TSchema,
  input: unknown,
  context: string
): v.InferOutput<TSchema> => {
  try {
    return v.parse(schema, input)
  } catch (error) {
    if (v.isValiError(error)) {
      throw new ConfigValidationError(context, error.issues)
    }
    throw error
  }
}
