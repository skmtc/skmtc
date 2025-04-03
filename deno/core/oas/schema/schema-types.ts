import * as v from 'valibot'
import { oasArrayData, type OasArrayData } from '../array/array-types.ts'
import { oasBooleanData, type OasBooleanData } from '../boolean/boolean-types.ts'
import { oasUnknownData, type OasUnknownData } from '../unknown/unknown-types.ts'
import { oasUnionData, type OasUnionData } from '../union/union-types.ts'
import { oasIntegerData, type OasIntegerData } from '../integer/integer-types.ts'
import { oasNumberData, type OasNumberData } from '../number/number-types.ts'
import { oasStringData, type OasStringData } from '../string/string-types.ts'
import { oasObjectData, type OasObjectData } from '../object/object-types.ts'

export type OasSchemaData =
  | OasArrayData
  | OasBooleanData
  | OasIntegerData
  | OasNumberData
  | OasStringData
  | OasObjectData
  | OasUnionData
  | OasUnknownData

export const oasSchemaData: v.GenericSchema<OasSchemaData> = v.union([
  oasObjectData,
  v.lazy(() => oasArrayData),
  oasBooleanData,
  oasStringData,
  oasNumberData,
  oasIntegerData,
  oasUnionData,
  oasUnknownData
])
