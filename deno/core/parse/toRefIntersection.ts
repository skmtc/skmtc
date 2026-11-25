import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { OasIntersection } from '@/oas/intersection/Intersection.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'

type ToRefIntersectionArgs = {
  ref: OasRef<'schema'>
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * An intersection of one reference, for a site that has a `not`: a reference
 * has no field for it. What the reference says of its site is also the
 * intersection's, as `null` is valid only when the intersection says so.
 * Shared by the 3.0, 3.1 and 3.2 parsers.
 */
export const toRefIntersection = ({ ref, stackTrail, context }: ToRefIntersectionArgs): OasIntersection =>
  context.withStackTrail(
    stackTrail,
    () =>
      new OasIntersection(
        {
          title: ref.title,
          description: ref.description,
          nullable: ref.nullable,
          readOnly: ref.readOnly,
          writeOnly: ref.writeOnly,
          deprecated: ref.deprecated,
          example: ref.example,
          default: ref.default,
          extensionFields: ref.extensionFields,
          members: [ref]
        },
        context
      )
  )
