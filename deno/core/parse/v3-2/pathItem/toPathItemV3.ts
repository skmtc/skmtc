import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toParameterListV3 } from '../parameter/toParameterV3.ts'
import { OasPathItem } from '@/oas/pathItem/PathItem.ts'
import { toOptionalServersV3 } from '@/parse/v3-2/server/toServerV3.ts'
import { tryParseAt } from '@/context/tryParseAt.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'
export type ToPathItemV3Args = {
  pathItem: OpenAPIV3.PathItemObject
  stackTrail: StackTrail
  context: ParseContextType
}

export const toPathItemV3 = ({ pathItem, stackTrail, context }: ToPathItemV3Args): OasPathItem => {
  const { summary, description, parameters, servers, ...skipped } = pathItem

  return new OasPathItem({
    summary,
    description,
    parameters: stackTrail.trace('parameters', st =>
      toParameterListV3({ parameters, stackTrail: st, context })
    ),
    servers: tryParseAt({
      stackTrail,
      key: 'servers',
      context,
      type: 'INVALID_OPERATION',
      parent: pathItem,
      fn: st => toOptionalServersV3({ servers, stackTrail: st, context })
    }),
    extensionFields: toSpecificationExtensionsV3({
      skipped,
      parent: pathItem,
      context,
      stackTrail,
      parentType: 'pathItem'
    })
  })
}

export type PathItemResult = { valid: true; pathItem: OasPathItem | undefined } | { valid: false }

/**
 * Parses a path item's shared fields without letting a throw escape. A
 * path-level parameter that fails validation (for example `in: body`) logs
 * one `INVALID_OPERATION` at the path and returns `{ valid: false }`, so
 * the caller skips that path and keeps the rest.
 */
export const toPathItemResultV3 = ({
  pathItem,
  stackTrail,
  context
}: ToPathItemV3Args): PathItemResult => {
  if (isEmpty(pathItem)) {
    return { valid: true, pathItem: undefined }
  }

  try {
    return { valid: true, pathItem: toPathItemV3({ pathItem, stackTrail, context }) }
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error))
    context.logIssueNoKey({
      parent: pathItem,
      level: 'error',
      message: normalized.message,
      cause: normalized,
      stackTrail,
      type: 'INVALID_OPERATION'
    })

    return { valid: false }
  }
}
