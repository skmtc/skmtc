import type { OpenAPIV3 } from 'openapi-types';
import type { ParseContext } from '../../context/ParseContext.js';
import { OasUnion } from './Union.js';
type ToUnionArgs = {
    value: OpenAPIV3.SchemaObject;
    members: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[];
    context: ParseContext;
};
export declare const toUnion: ({ value, members, context }: ToUnionArgs) => OasUnion;
export {};
//# sourceMappingURL=toUnion.d.ts.map