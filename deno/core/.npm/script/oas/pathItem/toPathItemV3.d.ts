import type { OpenAPIV3 } from 'openapi-types';
import type { ParseContext } from '../../context/ParseContext.js';
import { OasPathItem } from './PathItem.js';
type ToPathItemV3Args = {
    pathItem: OpenAPIV3.PathItemObject;
    context: ParseContext;
};
export declare const toPathItemV3: ({ pathItem, context }: ToPathItemV3Args) => OasPathItem;
export {};
//# sourceMappingURL=toPathItemV3.d.ts.map