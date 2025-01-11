import { z } from '@hono/zod-openapi';
export declare const oasIntegerData: z.ZodType<OasIntegerData>;
export type OasIntegerData = {
    title?: string;
    description?: string;
    default?: number;
    format?: 'int32' | 'int64';
    enum?: number[];
    nullable?: boolean;
    type: 'integer';
    example?: number;
};
//# sourceMappingURL=integer-types.d.ts.map