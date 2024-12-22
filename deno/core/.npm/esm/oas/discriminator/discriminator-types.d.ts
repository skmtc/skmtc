import { z } from 'zod';
export type OasDiscriminatorData = {
    oasType: 'discriminator';
    propertyName: string;
    mapping?: Record<string, string>;
};
export declare const oasDiscriminatorData: z.ZodType<OasDiscriminatorData>;
//# sourceMappingURL=discriminator-types.d.ts.map