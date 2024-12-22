import type { OpenAPIV3 } from 'openapi-types';
import type { ParseContext } from '../../context/ParseContext.js';
import { OasNumber } from './Number.js';
type ToNumberArgs = {
    value: OpenAPIV3.NonArraySchemaObject;
    context: ParseContext;
};
export declare const toNumber: ({ value, context }: ToNumberArgs) => OasNumber;
export {};
//# sourceMappingURL=toNumber.d.ts.map