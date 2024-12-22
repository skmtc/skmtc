import type { OpenAPIV3_1 } from 'npm:openapi-types@12.1.3'
import type { OasRefData } from './ref-types.ts'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasRef } from './Ref.ts'
import type { RefFields } from './Ref.ts'

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

  context.logSkippedFields(skipped)

  const fields: RefFields<T> = {
    refType,
    $ref,
    summary,
    description
  }

  return new OasRef(fields, context.oasDocument)
}
