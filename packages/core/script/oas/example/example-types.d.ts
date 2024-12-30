import { z } from 'zod';
export type OasExampleData = {
    oasType: 'example';
    summary?: string;
    description?: string;
    value?: unknown;
};
export declare const oasExampleData: z.ZodType<OasExampleData>;
//# sourceMappingURL=example-types.d.ts.map