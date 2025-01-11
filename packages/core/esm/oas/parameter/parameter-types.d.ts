import { type OasExampleData } from '../example/example-types.js';
import { type OasMediaTypeData } from '../mediaType/mediaType-types.js';
import { type OasExampleRefData, type OasSchemaRefData } from '../ref/ref-types.js';
import { type OasSchemaData } from '../schema/schema-types.js';
import { z } from '@hono/zod-openapi';
export type OasParameterLocation = 'query' | 'header' | 'path' | 'cookie';
export declare const oasParameterLocation: z.ZodType<OasParameterLocation>;
export type OasParameterStyle = 'matrix' | 'label' | 'form' | 'simple' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject';
export declare const oasParameterStyle: z.ZodType<OasParameterStyle>;
export type OasParameterData = {
    oasType: 'parameter';
    allowEmptyValue?: boolean;
    allowReserved?: boolean;
    content?: Record<string, OasMediaTypeData>;
    deprecated?: boolean;
    description?: string;
    examples?: Record<string, OasExampleData | OasExampleRefData>;
    explode: boolean;
    location: OasParameterLocation;
    name: string;
    required?: boolean;
    schema?: OasSchemaData | OasSchemaRefData;
    style: OasParameterStyle;
};
export declare const oasParameterData: z.ZodType<OasParameterData>;
//# sourceMappingURL=parameter-types.d.ts.map