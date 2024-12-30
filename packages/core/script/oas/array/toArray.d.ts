import type { OpenAPIV3 } from 'openapi-types';
import { OasArray } from './Array.js';
import type { ParseContext } from '../../context/ParseContext.js';
type ToArrayArgs = {
    value: OpenAPIV3.ArraySchemaObject;
    context: ParseContext;
};
export declare const toArray: ({ value, context }: ToArrayArgs) => OasArray;
export {};
//# sourceMappingURL=toArray.d.ts.map