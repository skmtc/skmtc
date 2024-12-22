import { z } from 'zod';
import { oasSchemaData } from '../schema/schema-types.js';
import { oasSchemaRefData } from '../ref/ref-types.js';
import { oasDiscriminatorData } from '../discriminator/discriminator-types.js';
export const oasUnionData = z.object({
    oasType: z.literal('schema'),
    type: z.literal('union'),
    title: z.string().optional(),
    description: z.string().optional(),
    members: z.lazy(() => z.array(z.union([oasSchemaData, oasSchemaRefData]))),
    discriminator: oasDiscriminatorData.optional()
});
