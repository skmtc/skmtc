import type { OasArray } from '../array/Array.ts'
import type { OasBoolean } from '../boolean/Boolean.ts'
import type { OasInteger } from '../integer/Integer.ts'
import type { OasNumber } from '../number/Number.ts'
import type { OasObject } from '../object/Object.ts'
import type { OasString } from '../string/String.ts'
import type { OasUnknown } from '../unknown/Unknown.ts'
import type { OasUnion } from '../union/Union.ts'
import type { OasIntersection } from '../intersection/Intersection.ts'

export type OasSchema =
  | OasArray
  | OasBoolean
  | OasInteger
  | OasNumber
  | OasObject
  | OasString
  | OasUnknown
  | OasUnion
  | OasIntersection
