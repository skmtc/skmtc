import type { OpenAPIV3 } from 'openapi-types';
import type { ParseContext } from '../../context/ParseContext.js';
import { OasString } from './String.js';
type ToStringArgs = {
    value: OpenAPIV3.NonArraySchemaObject;
    context: ParseContext;
};
export declare const toString: ({ value, context }: ToStringArgs) => OasString;
export {};
//# sourceMappingURL=toString.d.ts.map