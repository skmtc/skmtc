import { z } from 'zod'
import { oasArrayData, type OasArrayData } from '../array/array-types.js'
import {
  oasBooleanData,
  type OasBooleanData
} from '../boolean/boolean-types.js'
import { oasNullData, type OasNullData } from '../null/null-types.js'
import {
  oasUnknownData,
  type OasUnknownData
} from '../unknown/unknown-types.js'
import { oasUnionData, type OasUnionData } from '../union/union-types.js'
import {
  oasIntegerData,
  type OasIntegerData
} from '../integer/integer-types.js'
import { oasNumberData, type OasNumberData } from '../number/number-types.js'
import {
  oasIntersectionData,
  type OasIntersectionData
} from '../intersection/intersection-types.js'
import { oasStringData, type OasStringData } from '../string/string-types.js'
import { oasObjectData, type OasObjectData } from '../object/object-types.js'

export type OasSchemaData =
  | OasArrayData
  | OasBooleanData
  | OasNullData
  | OasIntegerData
  | OasNumberData
  | OasStringData
  | OasObjectData
  | OasUnionData
  | OasIntersectionData
  | OasUnknownData

export const oasSchemaData: z.ZodType<OasSchemaData> = z.union([
  oasObjectData,
  oasArrayData,
  oasBooleanData,
  oasStringData,
  oasNumberData,
  oasNullData,
  oasIntegerData,
  oasUnionData,
  oasIntersectionData,
  oasUnknownData
])
