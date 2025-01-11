import "../_dnt.polyfills.js";
import { z } from '@hono/zod-openapi';
export type ResultType = 'success' | 'warning' | 'error' | 'notSelected' | 'notSupported';
export type WarningError = 'warning' | 'error';
export declare const resultType: z.ZodEnum<["success", "warning", "error", "notSelected", "notSupported"]>;
export interface ResultsItem {
    [key: string]: ResultType | ResultsItem | Array<ResultsItem | null>;
}
export declare const resultsItem: z.ZodType<ResultsItem>;
export declare const resultsItemJsonSchema: object & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: object;
    } | undefined;
};
//# sourceMappingURL=Results.d.ts.map