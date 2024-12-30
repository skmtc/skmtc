import { z } from 'zod';
import { type OasSchemaData } from '../schema/schema-types.js';
import { type OasSchemaRefData } from '../ref/ref-types.js';
export declare const oasObjectData: z.ZodType<OasObjectData>;
export type OasObjectData = {
    oasType: 'schema';
    type: 'object';
    title?: string;
    description?: string;
    default?: Record<string, unknown>;
    properties?: Record<string, OasSchemaData | OasSchemaRefData>;
    required?: string[];
    additionalProperties?: boolean | OasSchemaData | OasSchemaRefData;
};
//# sourceMappingURL=object-types.d.ts.map