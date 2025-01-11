import "../_dnt.polyfills.js";
import { z } from '@hono/zod-openapi';
export declare const methodValues: readonly ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
export declare const methodValuesNoTrace: string[];
export declare const method: z.ZodType<Method>;
export type Method = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';
type Methods = Method[];
export declare const methods: z.ZodType<Methods>;
export declare const isMethod: (arg: unknown) => arg is Method;
export {};
//# sourceMappingURL=Method.d.ts.map