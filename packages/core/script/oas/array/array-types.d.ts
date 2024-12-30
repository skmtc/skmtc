import { z } from 'zod';
import { type OasSchemaData } from '../schema/schema-types.js';
import { type OasSchemaRefData } from '../ref/ref-types.js';
export declare const oasArrayData: z.ZodType<OasArrayData>;
export type OasArrayData = {
    oasType: 'schema';
    type: 'array';
    items: OasSchemaData | OasSchemaRefData;
    title?: string;
    description?: string;
    default?: unknown[];
};
//# sourceMappingURL=array-types.d.ts.map