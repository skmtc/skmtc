import type { OasRef } from '../oas/ref/Ref.js'
import type { OasSchema } from '../oas/schema/Schema.js'
import type { Modifiers } from './Modifiers.js'
import type { Stringable } from '../dsl/Stringable.js'
import type { GenerateContext } from '../context/GenerateContext.js'
import type { CustomValue } from './CustomValue.js'
import type { OasVoid } from '../oas/void/Void.js'
import type { GeneratorKey } from './GeneratorKeys.js'

export type TypeSystemValue =
  | TypeSystemArray
  | TypeSystemIntersection
  | TypeSystemObject
  | TypeSystemUnion
  | TypeSystemString
  | TypeSystemNumber
  | TypeSystemInteger
  | TypeSystemBoolean
  | TypeSystemUnknown
  | TypeSystemVoid
  | TypeSystemRef
  | TypeSystemNull
  | TypeSystemCustom

export type TypeSystemRef = {
  type: 'ref'
  name: string
  modifiers: Modifiers
  generatorKey?: GeneratorKey
}

export type TypeSystemCustom = {
  type: 'custom'
  value: Stringable
  generatorKey?: GeneratorKey
}

export type TypeSystemArray = {
  type: 'array'
  items: TypeSystemValue
  modifiers: Modifiers
  generatorKey?: GeneratorKey
}

export type TypeSystemNumber = {
  type: 'number'
  modifiers: Modifiers
  generatorKey?: GeneratorKey
}

export type TypeSystemVoid = {
  type: 'void'
  generatorKey?: GeneratorKey
}

export type TypeSystemInteger = {
  type: 'integer'
  modifiers: Modifiers
  generatorKey?: GeneratorKey
}

export type TypeSystemBoolean = {
  type: 'boolean'
  modifiers: Modifiers
  generatorKey?: GeneratorKey
}

export type TypeSystemUnknown = {
  type: 'unknown'
  generatorKey?: GeneratorKey
}

export type TypeSystemNull = {
  type: 'null'
  generatorKey?: GeneratorKey
}

export type TypeSystemIntersection = {
  type: 'intersection'
  members: TypeSystemValue[]
  modifiers: Modifiers
  generatorKey?: GeneratorKey
}

export type TypeSystemRecord = {
  value: TypeSystemValue | 'true'
  generatorKey?: GeneratorKey
}

export type TypeSystemObjectProperties = {
  properties: Record<string, TypeSystemValue>
  generatorKey?: GeneratorKey
}

export type TypeSystemString = {
  type: 'string'
  format: string | undefined
  enums: string[] | undefined
  modifiers: Modifiers
  generatorKey?: GeneratorKey
}

export type TypeSystemUnion = {
  type: 'union'
  members: TypeSystemValue[]
  discriminator: string | undefined
  modifiers: Modifiers
  generatorKey?: GeneratorKey
}

export type TypeSystemObject = {
  type: 'object'
  recordProperties: TypeSystemRecord | null
  objectProperties: TypeSystemObjectProperties | null
  modifiers: Modifiers
  generatorKey?: GeneratorKey
}

export type SchemaToTypeSystemMap = {
  ref: {
    source: OasRef<'schema'>
    output: TypeSystemRef
  }
  array: {
    source: OasSchema
    output: TypeSystemArray
  }
  number: {
    source: OasSchema
    output: TypeSystemNumber
  }
  void: {
    source: OasVoid
    output: TypeSystemVoid
  }
  integer: {
    source: OasSchema
    output: TypeSystemInteger
  }
  boolean: {
    source: OasSchema
    output: TypeSystemBoolean
  }
  unknown: {
    source: OasSchema
    output: TypeSystemUnknown
  }
  null: {
    source: OasSchema
    output: TypeSystemNull
  }
  intersection: {
    source: OasSchema
    output: TypeSystemIntersection
  }
  object: {
    source: OasSchema
    output: TypeSystemObject
  }
  string: {
    source: OasSchema
    output: TypeSystemString
  }
  union: {
    source: OasSchema
    output: TypeSystemUnion
  }
  custom: {
    source: CustomValue
    output: TypeSystemCustom
  }
}

export type SchemaType = OasSchema | OasRef<'schema'> | OasVoid | CustomValue

export type TypeSystemOutput<T extends keyof SchemaToTypeSystemMap> =
  SchemaToTypeSystemMap[T]['output']

export type TypeSystemArgs<Schema extends SchemaType> = {
  context: GenerateContext
  destinationPath: string
  schema: Schema
  required: boolean | undefined
}

export type SchemaToValueFn = <Schema extends SchemaType>(
  args: TypeSystemArgs<Schema>
) => TypeSystemOutput<Schema['type']>
