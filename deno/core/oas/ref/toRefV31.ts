import type { OpenAPIV3_1 } from 'openapi-types'
import type { OasRefData } from './ref-types.ts'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasRef } from './Ref.ts'

type ToRefV31Args<T extends OasRefData['refType']> = {
  ref: OpenAPIV3_1.ReferenceObject
  refType: T
  context: ParseContext
}

export const toRefV31 = <T extends OasRefData['refType']>({
  ref,
  refType,
  context
}: ToRefV31Args<T>): OasRef<T> => {
  const { $ref, summary, description, ...skipped } = ref

  context.logSkippedFields({ skipped, parent: ref, parentType: 'ref' })

  context.registerRef(context.stackTrail.clone(), $ref)

  return new OasRef(
    {
      refType,
      $ref,
      summary,
      description
    },
    context.oasDocument
  )
}
