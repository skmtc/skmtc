import type { OpenAPIV3_1 } from 'openapi-types'
import type { OasRefData } from '@/oas/ref/ref-types.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasRef } from '@/oas/ref/Ref.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
type ToRefV31Args<T extends OasRefData['refType']> = {
  ref: OpenAPIV3_1.ReferenceObject
  refType: T
  stackTrail: StackTrail
  context: ParseContextType
  /**
   * Use-site nullability to stamp on the OasRef node. Passed explicitly
   * by the single-member `oneOf`/`anyOf` collapse for a nullable
   * reference; omitted everywhere else (a plain `$ref` is non-nullable).
   */
  nullable?: boolean
}

export const toRefV31 = <T extends OasRefData['refType']>({
  ref,
  refType,
  stackTrail,
  context,
  nullable
}: ToRefV31Args<T>): OasRef<T> => {
  const { $ref, ...skipped } = ref

  if (!isEmpty(skipped)) {
    context.logSkippedFields({ skipped, parent: ref, parentType: 'ref', stackTrail })
  }

  context.registerRef(stackTrail.clone(), $ref)

  return context.withStackTrail(stackTrail, () =>
    new OasRef({ refType, $ref, nullable }, context)
  )
}
