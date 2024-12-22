import { toOptionalSchemaV3 } from '../schema/toSchemasV3.js';
import { toExamplesV3 } from '../example/toExamplesV3.js';
import { OasMediaType } from './MediaType.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toMediaTypeItemV3 = ({ mediaTypeItem, mediaType, context }) => {
    const { schema, example, examples, ...skipped } = mediaTypeItem;
    const extensionFields = toSpecificationExtensionsV3({
        skipped,
        context
    });
    const fields = {
        mediaType,
        schema: context.trace('schema', () => toOptionalSchemaV3({ schema, context })),
        examples: context.trace('examples', () => toExamplesV3({
            example,
            examples,
            exampleKey: mediaType,
            context
        })),
        extensionFields
    };
    return new OasMediaType(fields);
};
export const toMediaTypeItemsV3 = ({ content, context }) => {
    return Object.fromEntries(Object.entries(content).map(([mediaType, value]) => [
        mediaType,
        context.trace(mediaType, () => toMediaTypeItemV3({
            mediaTypeItem: value,
            mediaType,
            context
        }))
    ]));
};
export const toOptionalMediaTypeItemsV3 = ({ content, context }) => {
    if (!content) {
        return;
    }
    return toMediaTypeItemsV3({ content, context });
};
