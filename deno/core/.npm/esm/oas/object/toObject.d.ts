import type { OpenAPIV3 } from 'openapi-types';
import type { ParseContext } from '../../context/ParseContext.js';
import { OasObject } from './Object.js';
type ToObjectArgs = {
    value: OpenAPIV3.NonArraySchemaObject;
    context: ParseContext;
};
export declare const toObject: ({ value, context }: ToObjectArgs) => OasObject;
export {};
//# sourceMappingURL=toObject.d.ts.map