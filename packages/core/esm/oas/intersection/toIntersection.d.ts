import type { OpenAPIV3 } from 'openapi-types';
import type { ParseContext } from '../../context/ParseContext.js';
import { OasIntersection } from './Intersection.js';
type ToIntersectionArgs = {
    value: OpenAPIV3.SchemaObject;
    members: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[];
    context: ParseContext;
};
export declare const toIntersection: ({ value, members, context }: ToIntersectionArgs) => OasIntersection;
export {};
//# sourceMappingURL=toIntersection.d.ts.map