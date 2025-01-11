import { z } from '@hono/zod-openapi';
import { oasArrayData } from '../array/array-types.js';
import { oasBooleanData } from '../boolean/boolean-types.js';
import { oasNullData } from '../null/null-types.js';
import { oasUnknownData } from '../unknown/unknown-types.js';
import { oasUnionData } from '../union/union-types.js';
import { oasIntegerData } from '../integer/integer-types.js';
import { oasNumberData } from '../number/number-types.js';
import { oasIntersectionData } from '../intersection/intersection-types.js';
import { oasStringData } from '../string/string-types.js';
import { oasObjectData } from '../object/object-types.js';
export const oasSchemaData = z.union([
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
]);
