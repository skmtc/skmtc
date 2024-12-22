import type { OasArray } from '../array/Array.js'
import type { OasBoolean } from '../boolean/Boolean.js'
import type { OasInteger } from '../integer/Integer.js'
import type { OasNumber } from '../number/Number.js'
import type { OasObject } from '../object/Object.js'
import type { OasString } from '../string/String.js'
import type { OasUnknown } from '../unknown/Unknown.js'
import type { OasUnion } from '../union/Union.js'
import type { OasIntersection } from '../intersection/Intersection.js'

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
