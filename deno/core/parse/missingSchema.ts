import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { OasUnknown } from '@/oas/unknown/Unknown.ts'

export type ToMissingParameterSchemaArgs = {
  parameter: unknown
  name: string
  location: string
  /** Trail that ends in the parameter. */
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * The schema of a parameter with neither `schema` nor `content`: logs one
 * `MISSING_PARAMETER_SCHEMA` warning and returns an empty schema `{}`.
 * Shared by the 3.0, 3.1 and 3.2 parsers.
 */
export const toMissingParameterSchema = ({
  parameter,
  name,
  location,
  stackTrail,
  context
}: ToMissingParameterSchemaArgs): OasUnknown => {
  context.logIssueNoKey({
    stackTrail,
    parent: parameter,
    level: 'warning',
    type: 'MISSING_PARAMETER_SCHEMA',
    message: `Parameter '${name}' in ${location} has neither schema nor content; read as an empty schema {}`
  })

  return toEmptySchema({ stackTrail, context })
}

export type ToMissingHeaderSchemaArgs = {
  header: unknown
  name: string
  /** Trail that ends in the header. */
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * The schema of a header with neither `schema` nor `content`: logs one
 * `MISSING_HEADER_SCHEMA` warning and returns an empty schema `{}`.
 * Shared by the 3.0, 3.1 and 3.2 parsers.
 */
export const toMissingHeaderSchema = ({
  header,
  name,
  stackTrail,
  context
}: ToMissingHeaderSchemaArgs): OasUnknown => {
  context.logIssueNoKey({
    stackTrail,
    parent: header,
    level: 'warning',
    type: 'MISSING_HEADER_SCHEMA',
    message: `Header '${name}' has neither schema nor content; read as an empty schema {}`
  })

  return toEmptySchema({ stackTrail, context })
}

type ToEmptySchemaArgs = {
  stackTrail: StackTrail
  context: ParseContextType
}

/** The `{}` schema, as the parser reads it: an {@link OasUnknown}. */
const toEmptySchema = ({ stackTrail, context }: ToEmptySchemaArgs): OasUnknown =>
  stackTrail.trace('schema', st => context.withStackTrail(st, () => new OasUnknown({}, context)))
