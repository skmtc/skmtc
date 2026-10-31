import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToPresentResponsesArgs<Responses extends object> = {
  responses: Responses | null | undefined
  /** Trail that ends in the `responses` key. */
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * Check the `responses` field of an operation or webhook before its entries
 * are parsed. Shared by the 3.0, 3.1 and 3.2 parsers.
 *
 * - Missing or `null`: logs one `MISSING_RESPONSES` warning and returns
 *   `undefined`. The caller reads it as no documented responses.
 * - Not an object (an array, a string, a number): throws, so the operation
 *   is dropped as `INVALID_OPERATION` with a message that names `responses`.
 * - Otherwise: returns `responses`.
 */
export const toPresentResponses = <Responses extends object>({
  responses,
  stackTrail,
  context
}: ToPresentResponsesArgs<Responses>): Responses | undefined => {
  if (responses === undefined || responses === null) {
    context.logIssueNoKey({
      stackTrail,
      parent: undefined,
      level: 'warning',
      type: 'MISSING_RESPONSES',
      message: 'Operation has no responses; read as no documented responses'
    })

    return undefined
  }

  if (typeof responses !== 'object' || Array.isArray(responses)) {
    const actual = Array.isArray(responses) ? 'an array' : typeof responses
    throw new Error(`"responses" must be an object of status codes, got ${actual}`)
  }

  return responses
}
