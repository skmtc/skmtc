import { z } from '@hono/zod-openapi';
export declare const oasBooleanData: z.ZodType<OasBooleanData>;
export type OasBooleanData = {
    oasType: 'schema';
    title?: string;
    description?: string;
    default?: boolean;
    type: 'boolean';
};
//# sourceMappingURL=boolean-types.d.ts.map