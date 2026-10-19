import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import type { OasParameter } from '@/oas/parameter/Parameter.ts'
import type { OasPathItem } from '@/oas/pathItem/PathItem.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'

export type WarnQuerystringConflictsV3Args = {
  parameters: (OasParameter | OasRef<'parameter'>)[] | undefined
  pathItem: OasPathItem | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * Logs an `INVALID_PARAMETER` warning on the operation's `parameters` when
 * the operation and its path item together declare more than one
 * `querystring` parameter, or a `querystring` parameter alongside an
 * `in: query` parameter. An operation parameter replaces a path item
 * parameter with the same name and location. The parameters are kept.
 *
 * Only inline parameters are checked: a `$ref` parameter cannot be
 * resolved while the document is still being parsed.
 */
export const warnQuerystringConflictsV3 = ({
  parameters,
  pathItem,
  stackTrail,
  context
}: WarnQuerystringConflictsV3Args): void => {
  const inlineParameters = [...(pathItem?.parameters ?? []), ...(parameters ?? [])].filter(
    (parameter): parameter is OasParameter => !parameter.isRef()
  )

  const merged = [
    ...new Map(
      inlineParameters.map(parameter => [`${parameter.location}:${parameter.name}`, parameter])
    ).values()
  ]

  const querystringCount = merged.filter(({ location }) => location === 'querystring').length

  if (querystringCount === 0) {
    return
  }

  const queryNames = merged.filter(({ location }) => location === 'query').map(({ name }) => name)

  const messages = [
    querystringCount > 1
      ? `Operation has ${querystringCount} querystring parameters. At most one is allowed.`
      : undefined,
    queryNames.length
      ? `A querystring parameter must not appear with query parameters (${queryNames.join(', ')}).`
      : undefined
  ].filter((message): message is string => Boolean(message))

  messages.forEach(message => {
    context.logIssue({
      key: 'parameters',
      parent: parameters,
      level: 'warning',
      message,
      stackTrail,
      type: 'INVALID_PARAMETER'
    })
  })
}
