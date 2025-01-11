import { z } from '@hono/zod-openapi'
import { oasArrayData, type OasArrayData } from '../array/array-types.ts'
import { oasBooleanData, type OasBooleanData } from '../boolean/boolean-types.ts'
import { oasNullData, type OasNullData } from '../null/null-types.ts'
import { oasUnknownData, type OasUnknownData } from '../unknown/unknown-types.ts'
import { oasUnionData, type OasUnionData } from '../union/union-types.ts'
import { oasIntegerData, type OasIntegerData } from '../integer/integer-types.ts'
import { oasNumberData, type OasNumberData } from '../number/number-types.ts'
import {
  oasIntersectionData,
  type OasIntersectionData
} from '../intersection/intersection-types.ts'
import { oasStringData, type OasStringData } from '../string/string-types.ts'
import { oasObjectData, type OasObjectData } from '../object/object-types.ts'

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
