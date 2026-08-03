import type {
  CustomValue,
  GenerateContextType,
  GeneratorKey,
  OasRef,
  OasSchema,
  OasVoid
} from '@skmtc/core'

export type SchemaValue = OasSchema | OasRef<'schema'> | OasVoid | CustomValue

export type ToTypeboxValueArgs = {
  schema: SchemaValue
  destinationPath: string
  context: GenerateContextType
  generatorKey?: GeneratorKey
}
