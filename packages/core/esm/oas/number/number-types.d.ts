import { z } from '@hono/zod-openapi';
export declare const oasNumberData: z.ZodType<OasNumberData>;
export type OasNumberData = {
    oasType: 'schema';
    title?: string;
    description?: string;
    default?: number;
    type: 'number';
};
//# sourceMappingURL=number-types.d.ts.map