import { z } from '@hono/zod-openapi';
import { type OasSchemaData } from '../schema/schema-types.js';
import { type OasSchemaRefData } from '../ref/ref-types.js';
import { type OasDiscriminatorData } from '../discriminator/discriminator-types.js';
export type OasUnionData = {
    oasType: 'schema';
    type: 'union';
    title?: string;
    description?: string;
    members: (OasSchemaData | OasSchemaRefData)[];
    discriminator?: OasDiscriminatorData;
};
export declare const oasUnionData: z.ZodType<OasUnionData>;
//# sourceMappingURL=union-types.d.ts.map