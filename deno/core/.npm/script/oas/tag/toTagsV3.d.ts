import type { OpenAPIV3 } from 'openapi-types';
import type { ParseContext } from '../../context/ParseContext.js';
import { OasTag } from './Tag.js';
type ToTagsV3Args = {
    tags: OpenAPIV3.TagObject[] | undefined;
    context: ParseContext;
};
export declare const toTagsV3: ({ tags, context }: ToTagsV3Args) => OasTag[] | undefined;
type ToTagV3Args = {
    tag: OpenAPIV3.TagObject;
    context: ParseContext;
};
export declare const toTagV3: ({ tag, context }: ToTagV3Args) => OasTag;
export {};
//# sourceMappingURL=toTagsV3.d.ts.map