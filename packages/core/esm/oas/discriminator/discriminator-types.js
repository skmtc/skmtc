import { z } from 'zod';
export const oasDiscriminatorData = z.object({
    oasType: z.literal('discriminator'),
    propertyName: z.string(),
    mapping: z.record(z.string()).optional()
});
