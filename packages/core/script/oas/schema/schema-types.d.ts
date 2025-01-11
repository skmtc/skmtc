import { z } from '@hono/zod-openapi';
import { type OasArrayData } from '../array/array-types.js';
import { type OasBooleanData } from '../boolean/boolean-types.js';
import { type OasNullData } from '../null/null-types.js';
import { type OasUnknownData } from '../unknown/unknown-types.js';
import { type OasUnionData } from '../union/union-types.js';
import { type OasIntegerData } from '../integer/integer-types.js';
import { type OasNumberData } from '../number/number-types.js';
import { type OasIntersectionData } from '../intersection/intersection-types.js';
import { type OasStringData } from '../string/string-types.js';
import { type OasObjectData } from '../object/object-types.js';
export type OasSchemaData = OasArrayData | OasBooleanData | OasNullData | OasIntegerData | OasNumberData | OasStringData | OasObjectData | OasUnionData | OasIntersectionData | OasUnknownData;
export declare const oasSchemaData: z.ZodType<OasSchemaData>;
//# sourceMappingURL=schema-types.d.ts.map