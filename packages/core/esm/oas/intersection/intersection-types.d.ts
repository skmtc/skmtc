import { z } from '@hono/zod-openapi';
import { type OasSchemaData } from '../schema/schema-types.js';
import { type OasSchemaRefData } from '../ref/ref-types.js';
import { type OasDiscriminatorData } from '../discriminator/discriminator-types.js';
export type OasIntersectionData = {
    oasType: 'schema';
    type: 'intersection';
    title?: string;
    description?: string;
    members: (OasSchemaData | OasSchemaRefData)[];
    discriminator?: OasDiscriminatorData;
};
export declare const oasIntersectionData: z.ZodType<OasIntersectionData>;
//# sourceMappingURL=intersection-types.d.ts.map