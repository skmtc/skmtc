import { isCustomValue } from '@skmtc/core'
import type { Stringable } from '@skmtc/core'
import { TypeboxObject } from './TypeboxObject.ts'
import { TypeboxString } from './TypeboxString.ts'
import { TypeboxArray } from './TypeboxArray.ts'
import { TypeboxUnion } from './TypeboxUnion.ts'
import { TypeboxScalar } from './TypeboxScalar.ts'
import { TypeboxRef } from './TypeboxRef.ts'
import type { ToTypeboxValueArgs } from './types.ts'

export const toTypeboxValue = ({
  schema,
  destinationPath,
  context,
  generatorKey
}: ToTypeboxValueArgs): Stringable => {
  if (isCustomValue(schema)) {
    return schema
  }

  switch (schema.type) {
    case 'object':
      return new TypeboxObject({ context, objectSchema: schema, destinationPath, generatorKey })
    case 'string':
      return new TypeboxString({ context, stringSchema: schema, destinationPath, generatorKey })
    case 'array':
      return new TypeboxArray({ context, arraySchema: schema, destinationPath, generatorKey })
    case 'union':
      return new TypeboxUnion({ context, unionSchema: schema, destinationPath, generatorKey })
    case 'ref':
      return new TypeboxRef({ context, refSchema: schema, destinationPath, generatorKey })
    case 'number':
    case 'integer':
    case 'boolean':
      return new TypeboxScalar({
        context,
        kind: schema.type,
        stackTrail: schema.stackTrail.clone(),
        nullable: schema.nullable,
        destinationPath,
        generatorKey
      })
    case 'unknown':
    case 'void':
      return new TypeboxScalar({
        context,
        kind: schema.type,
        stackTrail: schema.stackTrail.clone(),
        nullable: undefined,
        destinationPath,
        generatorKey
      })
    default: {
      const _exhaustive: never = schema
      throw new Error(`Unsupported schema type: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
