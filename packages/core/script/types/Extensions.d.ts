import "../_dnt.polyfills.js";
import { z } from 'zod';
export type Extensions = {
    [k: string]: string | Extensions;
};
export declare const extensions: z.ZodType<Extensions>;
//# sourceMappingURL=Extensions.d.ts.map