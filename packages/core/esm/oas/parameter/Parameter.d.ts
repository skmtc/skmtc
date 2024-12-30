import type { OasParameterLocation, OasParameterStyle } from './parameter-types.js';
import type { OasMediaType } from '../mediaType/MediaType.js';
import type { OasRef } from '../ref/Ref.js';
import type { OasExample } from '../example/Example.js';
import type { OasSchema } from '../schema/Schema.js';
export type ParameterFields = {
    name: string;
    location: OasParameterLocation;
    description?: string | undefined;
    required?: boolean | undefined;
    deprecated?: boolean | undefined;
    allowEmptyValue?: boolean | undefined;
    allowReserved?: boolean | undefined;
    schema?: OasSchema | OasRef<'schema'> | undefined;
    examples?: Record<string, OasExample | OasRef<'example'>> | undefined;
    content?: Record<string, OasMediaType> | undefined;
    style: OasParameterStyle;
    explode: boolean;
    extensionFields?: Record<string, unknown>;
};
export declare class OasParameter {
    oasType: 'parameter';
    name: string;
    location: OasParameterLocation;
    description?: string | undefined;
    required?: boolean | undefined;
    deprecated?: boolean | undefined;
    allowEmptyValue?: boolean | undefined;
    allowReserved?: boolean | undefined;
    schema?: OasSchema | OasRef<'schema'> | undefined;
    examples?: Record<string, OasExample | OasRef<'example'>> | undefined;
    content?: Record<string, OasMediaType> | undefined;
    style: OasParameterStyle;
    explode: boolean;
    extensionFields: Record<string, unknown> | undefined;
    constructor(fields: ParameterFields);
    isRef(): this is OasRef<'parameter'>;
    resolve(): OasParameter;
    resolveOnce(): OasParameter;
    toSchema(mediaType?: string): OasSchema | OasRef<'schema'>;
}
//# sourceMappingURL=Parameter.d.ts.map