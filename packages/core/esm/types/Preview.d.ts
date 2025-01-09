import "../_dnt.polyfills.js";
import { z } from 'zod';
export type Preview = {
    importName: string;
    importPath: string;
    group: string;
    route?: string;
};
export declare const preview: z.ZodObject<{
    importName: z.ZodString;
    importPath: z.ZodString;
    group: z.ZodString;
    route: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    importName: string;
    importPath: string;
    group: string;
    route?: string | undefined;
}, {
    importName: string;
    importPath: string;
    group: string;
    route?: string | undefined;
}>;
//# sourceMappingURL=Preview.d.ts.map