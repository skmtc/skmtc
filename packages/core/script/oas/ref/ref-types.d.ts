import { z } from 'zod';
export type OasSchemaRefData = {
    oasType: 'ref';
    refType: 'schema';
    $ref: string;
    summary?: string;
    description?: string;
};
export declare const oasSchemaRefData: z.ZodType<OasSchemaRefData>;
export type OasResponseRefData = {
    oasType: 'ref';
    refType: 'response';
    $ref: string;
    summary?: string;
    description?: string;
};
export declare const oasResponseRefData: z.ZodType<OasResponseRefData>;
export type OasParameterRefData = {
    oasType: 'ref';
    refType: 'parameter';
    $ref: string;
    summary?: string;
    description?: string;
};
export declare const oasParameterRefData: z.ZodType<OasParameterRefData>;
export type OasExampleRefData = {
    oasType: 'ref';
    refType: 'example';
    $ref: string;
    summary?: string;
    description?: string;
};
export declare const oasExampleRefData: z.ZodType<OasExampleRefData>;
export type OasRequestBodyRefData = {
    oasType: 'ref';
    refType: 'requestBody';
    $ref: string;
    summary?: string;
    description?: string;
};
export declare const oasRequestBodyRefData: z.ZodType<OasRequestBodyRefData>;
export type OasHeaderRefData = {
    oasType: 'ref';
    refType: 'header';
    $ref: string;
    summary?: string;
    description?: string;
};
export declare const oasHeaderRefData: z.ZodType<OasHeaderRefData>;
export type OasRefData = OasSchemaRefData | OasResponseRefData | OasParameterRefData | OasExampleRefData | OasRequestBodyRefData | OasHeaderRefData;
export declare const oasRefData: z.ZodType<OasRefData>;
//# sourceMappingURL=ref-types.d.ts.map