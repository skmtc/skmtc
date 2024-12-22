import type { OpenAPIV3 } from 'openapi-types';
import type { ParseContext } from '../../context/ParseContext.js';
import { OasInteger } from './Integer.js';
type ToIntegerArgs = {
    value: OpenAPIV3.NonArraySchemaObject;
    context: ParseContext;
};
export declare const toInteger: ({ value, context }: ToIntegerArgs) => OasInteger;
export {};
//# sourceMappingURL=toInteger.d.ts.map