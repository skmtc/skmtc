import type { OpenAPIV3_1 } from 'openapi-types'
import type { OasRefData } from './ref-types.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasRef } from './Ref.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
type ToRefV31Args<T extends OasRefData['refType']> = {
  ref: OpenAPIV3_1.ReferenceObject
  refType: T
  stackTrail: StackTrail
  context: ParseContextType
}

export const toRefV31 = <T extends OasRefData['refType']>({
  ref,
  refType,
  stackTrail,
  context
}: ToRefV31Args<T>): OasRef<T> => {
  const { $ref, ...skipped } = ref

  if (!isEmpty(skipped)) {
    context.logSkippedFields({ skipped, parent: ref, parentType: 'ref', stackTrail })
  }

  context.registerRef(stackTrail.clone(), $ref)

  return new OasRef(
    {
      refType,
      $ref
    },
    context.parsedDocument
  )
}
