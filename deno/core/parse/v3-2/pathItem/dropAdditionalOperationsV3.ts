import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type DropAdditionalOperationsV3Args = {
  pathItem: OpenAPIV3.PathItemObject
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * Removes the 3.2 `additionalOperations` map from a path item and logs one
 * `UNSUPPORTED_OPERATION_METHOD` warning per entry, naming the method. The
 * operations are dropped: no generator renders an arbitrary method yet.
 *
 * A value that is not a map (a primitive or an array) stays on the path
 * item, so the path item parser reports it as a skipped field.
 */
export const dropAdditionalOperationsV3 = ({
  pathItem,
  stackTrail,
  context
}: DropAdditionalOperationsV3Args): OpenAPIV3.PathItemObject => {
  // `Object.hasOwn` is false for a primitive path item value, which the
  // path item parser then reports as a skipped field.
  if (!Object.hasOwn(pathItem, 'additionalOperations') || !('additionalOperations' in pathItem)) {
    return pathItem
  }

  const { additionalOperations, ...rest } = pathItem

  if (
    typeof additionalOperations !== 'object' ||
    additionalOperations === null ||
    Array.isArray(additionalOperations)
  ) {
    return pathItem
  }

  stackTrail.trace('additionalOperations', st => {
    Object.entries(additionalOperations).forEach(([method, operation]) => {
      context.logIssue({
        key: method,
        parent: operation,
        level: 'warning',
        message: `Operation method '${method}' in additionalOperations is not supported. The operation is dropped.`,
        stackTrail: st,
        type: 'UNSUPPORTED_OPERATION_METHOD'
      })
    })
  })

  return rest
}
