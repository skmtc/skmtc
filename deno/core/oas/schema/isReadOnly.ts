import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { CustomValue } from '@/dsl/CustomValue.ts'

/** How many references `isReadOnly` follows before it stops: a chain of references only, with no schema, is an error elsewhere. */
const MAX_REFERENCES = 32

/**
 * Whether a property is read-only, as Forge reads it: `readOnly: true` on the
 * property's schema, on a reference to it (`{ allOf: [{ $ref }], readOnly:
 * true }`, see `RefFields.readOnly`), or on the schema a reference points to,
 * following references through any chain of them. A `readOnly: false` does
 * not undo another's `true`.
 */
export const isReadOnly = (schema: OasSchema | OasRef<'schema'> | CustomValue, references = 0): boolean => {
  if (schema.isRef()) {
    return schema.readOnly === true || (references < MAX_REFERENCES && isReadOnly(schema.resolveOnce(), references + 1))
  }

  return 'readOnly' in schema && schema.readOnly === true
}
