import type { OasSchema } from '@/oas/schema/Schema.ts'

/** The keywords every schema has that only describe a value: they apply next to a reference of any type. Each class types `example` itself, so it is not here. */
type SiblingAnnotations = {
  title: string | undefined
  description: string | undefined
  extensionFields: Record<string, unknown> | undefined
}

/**
 * The annotations of `target` with those of `siblings` (the keywords next to
 * a reference, see `RefFields.siblings`) applied: a sibling's value wins,
 * and extension fields merge, a sibling's key winning. They apply whatever
 * the two types are.
 */
export const toSiblingAnnotations = (target: OasSchema, siblings: OasSchema): SiblingAnnotations => ({
  title: siblings.title ?? target.title,
  description: siblings.description ?? target.description,
  extensionFields: target.extensionFields === undefined && siblings.extensionFields === undefined
    ? undefined
    : { ...target.extensionFields, ...siblings.extensionFields }
})

/** `deprecated` on the keywords next to a reference, or `undefined` when they do not say. */
export const toSiblingDeprecated = (siblings: OasSchema): boolean | undefined =>
  'deprecated' in siblings ? siblings.deprecated : undefined
