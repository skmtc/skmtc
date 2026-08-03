import type { GenerateContextType, OasRef, OasSchema, OasVoid } from '@skmtc/core'
import { register } from '@skmtc/lang-typescript'
import { ZodProjection } from '@skmtc/gen-zod'
import { join } from '@std/path'

type InsertZodSchemaArgs = {
  context: GenerateContextType
  schema: OasSchema | OasRef<'schema'> | OasVoid
  fallbackName: string
  destinationPath: string
}

/**
 * Insert a zod schema for `schema` and return its exported name, imported
 * into `destinationPath`. Named `$ref` schemas resolve through gen-zod's
 * projection to their own model file; anonymous schemas are given their own
 * file under `@/types` (rather than being defined inline at
 * `destinationPath`) so every schema definition lands in a schema file.
 */
export const insertZodSchema = ({
  context,
  schema,
  fallbackName,
  destinationPath
}: InsertZodSchemaArgs): string => {
  if (schema.isRef()) {
    const definition = context.insertNormalizedModel(ZodProjection, {
      schema,
      fallbackName,
      destinationPath
    })

    return definition.identifier.name
  }

  const exportPath = join('@', 'types', `${fallbackName}.generated.ts`)

  const definition = context.insertNormalizedModel(ZodProjection, {
    schema,
    fallbackName,
    destinationPath: exportPath
  })

  register(context, {
    imports: { [exportPath]: [definition.identifier.name] },
    destinationPath
  })

  return definition.identifier.name
}
