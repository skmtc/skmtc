import type {
  CustomValue,
  GenerateContextType,
  GeneratorKey,
  OasRef,
  OasSchema,
  Stringable
} from '@skmtc/core'
import { TypeboxArray } from './TypeboxArray.ts'
import { TypeboxObject } from './TypeboxObject.ts'
import { TypeboxRef } from './TypeboxRef.ts'
import { TypeboxScalar } from './TypeboxScalar.ts'
import { TypeboxString } from './TypeboxString.ts'
import { TypeboxUnion } from './TypeboxUnion.ts'

export type TypeboxValueArgs = {
  schema: OasSchema | OasRef<'schema'> | CustomValue
  required: boolean
  destinationPath: string
  context: GenerateContextType
  generatorKey?: GeneratorKey
}

export const toTypeboxValue = ({
  schema,
  required,
  destinationPath,
  context,
  generatorKey
}: TypeboxValueArgs): Stringable => {
  switch (schema.type) {
    case 'object':
      return new TypeboxObject({ context, objectSchema: schema, required, destinationPath, generatorKey })
    case 'array':
      return new TypeboxArray({ context, arraySchema: schema, required, destinationPath, generatorKey })
    case 'string':
      return new TypeboxString({ context, stringSchema: schema, required, destinationPath, generatorKey })
    case 'union':
      return new TypeboxUnion({ context, unionSchema: schema, required, destinationPath, generatorKey })
    case 'ref':
      return new TypeboxRef({ context, ref: schema, required, destinationPath, generatorKey })
    case 'number':
    case 'integer':
    case 'boolean':
    case 'unknown':
      return new TypeboxScalar({
        context,
        kind: schema.type,
        modifiers: { required, nullable: schema.nullable },
        destinationPath,
        generatorKey
      })
    case 'custom':
      return schema
    default: {
      const _exhaustive: never = schema
      throw new Error(`Unhandled schema type: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
