import type { GenerateContextType, OasRef, OasSchema, OasVoid } from '@skmtc/core'
import { ZodProjection } from '@skmtc/gen-zod'
import { register } from '@skmtc/lang-typescript'
import { join } from '@std/path'

type InsertZodModelArgs = {
  context: GenerateContextType
  schema: OasSchema | OasRef<'schema'> | OasVoid
  fallbackName: string
  destinationPath: string
}

/**
 * Materialize the zod schema for `schema` through gen-zod's projection and
 * return its exported constant name, imported into `destinationPath`.
 *
 * A `$ref` lands at gen-zod's own export path with the import stitched by the
 * engine. An inline schema has no refName to derive a home from, so it is
 * placed in its own types file under the fallback name and the import is
 * registered from the identifier the insert returned.
 */
export const insertZodModel = ({
  context,
  schema,
  fallbackName,
  destinationPath
}: InsertZodModelArgs): string => {
  if (schema.isRef()) {
    const definition = context.insertNormalizedModel(ZodProjection, {
      schema,
      fallbackName,
      destinationPath
    })

    return definition.identifier.name
  }

  const modelPath = join('@', 'types', `${fallbackName}.generated.ts`)

  const definition = context.insertNormalizedModel(ZodProjection, {
    schema,
    fallbackName,
    destinationPath: modelPath
  })

  register(context, {
    imports: { [modelPath]: [definition.identifier.name] },
    destinationPath
  })

  return definition.identifier.name
}
