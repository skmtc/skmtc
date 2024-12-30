import type { OpenAPIV3 } from 'openapi-types';
import type { ParseContext } from '../../context/ParseContext.js';
import { OasMediaType } from './MediaType.js';
type ToMediaTypeItemV3Args = {
    mediaTypeItem: OpenAPIV3.MediaTypeObject;
    mediaType: string;
    context: ParseContext;
};
export declare const toMediaTypeItemV3: ({ mediaTypeItem, mediaType, context }: ToMediaTypeItemV3Args) => OasMediaType;
type ToMediaTypeItemsV3Args = {
    content: Record<string, OpenAPIV3.MediaTypeObject>;
    context: ParseContext;
};
export declare const toMediaTypeItemsV3: ({ content, context }: ToMediaTypeItemsV3Args) => Record<string, OasMediaType>;
type ToOptionalMediaTypeItemsV3Args = {
    content: Record<string, OpenAPIV3.MediaTypeObject> | undefined;
    context: ParseContext;
};
export declare const toOptionalMediaTypeItemsV3: ({ content, context }: ToOptionalMediaTypeItemsV3Args) => Record<string, OasMediaType> | undefined;
export {};
//# sourceMappingURL=toMediaTypeItemV3.d.ts.map