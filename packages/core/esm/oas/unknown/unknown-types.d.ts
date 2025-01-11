import { z } from '@hono/zod-openapi';
export declare const oasUnknownData: z.ZodType<OasUnknownData>;
export type OasUnknownData = {
    oasType: 'schema';
    title?: string;
    description?: string;
    default?: unknown;
    type: 'unknown';
};
//# sourceMappingURL=unknown-types.d.ts.map