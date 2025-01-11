import { z } from '@hono/zod-openapi';
export declare const oasNullData: z.ZodType<OasNullData>;
export type OasNullData = {
    oasType: 'schema';
    title?: string;
    description?: string;
    default?: null;
    type: 'null';
};
//# sourceMappingURL=null-types.d.ts.map