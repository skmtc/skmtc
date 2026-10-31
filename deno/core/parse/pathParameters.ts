import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { isEmptyParameter } from '@/parse/emptyParameter.ts'
import { toDocumentString } from '@/context/documentTrail.ts'

/**
 * Reads a `parameters` field. `undefined` is no parameters. `{}` or `null`
 * is read as no parameters with an `EMPTY_PARAMETER` warning at the
 * field. Any other value that is not an array throws.
 */
export const toParameterEntries = <Entry>({
  parameters,
  stackTrail,
  context
}: {
  parameters: Entry[] | undefined
  /** Trail that ends in `parameters`. */
  stackTrail: StackTrail
  context: ParseContextType
}): Entry[] | undefined => {
  if (parameters === undefined) {
    return undefined
  }

  if (Array.isArray(parameters)) {
    return parameters
  }

  if (isEmptyParameter(parameters)) {
    context.logIssueNoKey({
      stackTrail,
      parent: parameters,
      level: 'warning',
      type: 'EMPTY_PARAMETER',
      message: 'Empty parameters field; read as no parameters'
    })

    return undefined
  }

  throw new Error(`Expected parameters to be an array but received ${typeof parameters}`)
}

/** A path-level parameter entry, or the whole field, that failed to parse. */
export type BrokenPathParameter = {
  /** Document-relative trail of the entry, or of the `parameters` field when it is not an array. */
  location: string
  /** Set only when the raw entry has string `name` and `in`. */
  name?: string
  in?: string
  message: string
}

export type PathParameterList<Parameter> = {
  parameters: Parameter[] | undefined
  broken: BrokenPathParameter[]
}

export type ToPathParameterListArgs<Entry, Parameter> = {
  parameters: Entry[] | undefined
  /** Trail that ends in `parameters`. */
  stackTrail: StackTrail
  context: ParseContextType
  /** The tree's parser for one list entry, as used by `toParameterListV3`. */
  toEntry: (args: { parameter: Entry; index: number }) => Parameter[]
}

const toMessage = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error))

const toNameAndLocation = (parameter: unknown): Pick<BrokenPathParameter, 'name' | 'in'> => {
  if (
    typeof parameter === 'object' &&
    parameter !== null &&
    'name' in parameter &&
    'in' in parameter &&
    typeof parameter.name === 'string' &&
    typeof parameter.in === 'string'
  ) {
    return { name: parameter.name, in: parameter.in }
  }

  return {}
}

/**
 * Parses a path item's `parameters` without letting a throw escape. Each
 * entry that fails logs one `INVALID_PARAMETER` error at its index and is
 * returned in `broken`; a field that is not an array logs one at the field.
 * The caller decides per operation which broken entries apply.
 */
export const toPathParameterList = <Entry, Parameter>({
  parameters,
  stackTrail,
  context,
  toEntry
}: ToPathParameterListArgs<Entry, Parameter>): PathParameterList<Parameter> => {
  const logBroken = (st: StackTrail, parent: unknown, error: unknown): BrokenPathParameter => {
    const normalized = toMessage(error)
    context.logIssueNoKey({
      level: 'error',
      stackTrail: st,
      parent,
      message: normalized.message,
      cause: normalized,
      type: 'INVALID_PARAMETER'
    })

    return { location: toDocumentString(st.stackTrail), message: normalized.message }
  }

  const readEntries = (): { entries: Entry[] | undefined } | { broken: BrokenPathParameter } => {
    try {
      return { entries: toParameterEntries({ parameters, stackTrail, context }) }
    } catch (error) {
      // A field that is not an array cannot be matched to an override.
      return { broken: logBroken(stackTrail, parameters, error) }
    }
  }

  const read = readEntries()

  if ('broken' in read) {
    return { parameters: undefined, broken: [read.broken] }
  }

  if (read.entries === undefined) {
    return { parameters: undefined, broken: [] }
  }

  const results = read.entries.map(
    (parameter, index): { parsed: Parameter[]; broken: BrokenPathParameter[] } => {
      try {
        return { parsed: toEntry({ parameter, index }), broken: [] }
      } catch (error) {
        return {
          parsed: [],
          broken: [
            {
              ...stackTrail.trace(`${index}`, st => logBroken(st, parameter, error)),
              ...toNameAndLocation(parameter)
            }
          ]
        }
      }
    }
  )

  return {
    parameters: results.flatMap(({ parsed }) => parsed),
    broken: results.flatMap(({ broken }) => broken)
  }
}

/**
 * The first broken path-level parameter that applies to an operation. An
 * entry applies unless it has a readable `name` and `in` and the
 * operation's inline `parameters` hold the same pair, which overrides it.
 * A `$ref` operation parameter cannot be resolved during parse, so it
 * overrides nothing.
 */
const toApplyingBrokenParameter = ({
  broken,
  operation
}: {
  broken: BrokenPathParameter[]
  /** The raw operation object. */
  operation: unknown
}): BrokenPathParameter | undefined => {
  if (broken.length === 0) {
    return undefined
  }

  const operationParameters =
    typeof operation === 'object' &&
    operation !== null &&
    'parameters' in operation &&
    Array.isArray(operation.parameters)
      ? operation.parameters
      : []

  const overrides = new Set(
    operationParameters.flatMap((parameter: unknown) => {
      const { name, in: location } = toNameAndLocation(parameter)
      return name === undefined || location === undefined ? [] : [`${location}:${name}`]
    })
  )

  return broken.find(
    entry =>
      entry.name === undefined ||
      entry.in === undefined ||
      !overrides.has(`${entry.in}:${entry.name}`)
  )
}

/**
 * True when a broken path-level parameter applies to the operation. Logs
 * one `INVALID_OPERATION` error at the operation that names the first
 * such entry.
 */
export const isDroppedByPathParameter = ({
  brokenParameters,
  operation,
  stackTrail,
  context
}: {
  brokenParameters: BrokenPathParameter[]
  /** The raw operation object. */
  operation: unknown
  /** Trail that ends in the operation's method. */
  stackTrail: StackTrail
  context: ParseContextType
}): boolean => {
  const broken = toApplyingBrokenParameter({ broken: brokenParameters, operation })

  if (!broken) {
    return false
  }

  context.logIssueNoKey({
    parent: operation,
    level: 'error',
    message: `Path-level parameter ${broken.location} failed to parse: ${broken.message}`,
    stackTrail,
    type: 'INVALID_OPERATION'
  })

  return true
}
