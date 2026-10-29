import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasMediaType } from '@/oas/mediaType/MediaType.ts'
import { toJsonContent } from '@/oas/mediaType/jsonMediaType.ts'

/**
 * The schema a `toSchema(mediaType?)` lookup returns: an exact key lookup when
 * `mediaType` is given, else the schema of `toJsonContent`.
 */
export const toContentSchema = (
  content: Record<string, OasMediaType> | undefined,
  mediaType: string | undefined
): OasSchema | OasRef<'schema'> | undefined =>
  mediaType === undefined ? toJsonContent(content)?.schema : content?.[mediaType]?.schema
