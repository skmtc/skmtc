import type { ParseContext } from '../../context/ParseContext.js';
import type { OpenAPIV3 } from 'openapi-types';
import { OasParameter } from './Parameter.js';
import type { OasRef } from '../ref/Ref.js';
type ToParameterListV3Args = {
    parameters: (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[] | undefined;
    context: ParseContext;
};
export declare const toParameterListV3: ({ parameters, context }: ToParameterListV3Args) => (OasParameter | OasRef<"parameter">)[] | undefined;
type ToParametersV3Args = {
    parameters: Record<string, OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject>;
    context: ParseContext;
};
export declare const toParametersV3: ({ parameters, context }: ToParametersV3Args) => Record<string, OasParameter | OasRef<"parameter">>;
type ToOptionalParametersV3Args = {
    parameters: Record<string, OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject> | undefined;
    context: ParseContext;
};
export declare const toOptionalParametersV3: ({ parameters, context }: ToOptionalParametersV3Args) => Record<string, OasParameter | OasRef<"parameter">> | undefined;
export {};
//# sourceMappingURL=toParameterV3.d.ts.map