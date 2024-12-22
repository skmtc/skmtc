import type { OpenAPIV3 } from 'openapi-types';
import type { ParseContext } from '../../context/ParseContext.js';
import { OasUnknown } from './Unknown.js';
type ToUnknownArgs = {
    value: OpenAPIV3.NonArraySchemaObject;
    context: ParseContext;
};
export declare const toUnknown: ({ value, context }: ToUnknownArgs) => OasUnknown;
export {};
//# sourceMappingURL=toUnknown.d.ts.map