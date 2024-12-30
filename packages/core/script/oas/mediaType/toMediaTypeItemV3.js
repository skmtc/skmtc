"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toOptionalMediaTypeItemsV3 = exports.toMediaTypeItemsV3 = exports.toMediaTypeItemV3 = void 0;
const toSchemasV3_js_1 = require("../schema/toSchemasV3.js");
const toExamplesV3_js_1 = require("../example/toExamplesV3.js");
const MediaType_js_1 = require("./MediaType.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toMediaTypeItemV3 = ({ mediaTypeItem, mediaType, context }) => {
    const { schema, example, examples, ...skipped } = mediaTypeItem;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({
        skipped,
        context
    });
    const fields = {
        mediaType,
        schema: context.trace('schema', () => (0, toSchemasV3_js_1.toOptionalSchemaV3)({ schema, context })),
        examples: context.trace('examples', () => (0, toExamplesV3_js_1.toExamplesV3)({
            example,
            examples,
            exampleKey: mediaType,
            context
        })),
        extensionFields
    };
    return new MediaType_js_1.OasMediaType(fields);
};
exports.toMediaTypeItemV3 = toMediaTypeItemV3;
const toMediaTypeItemsV3 = ({ content, context }) => {
    return Object.fromEntries(Object.entries(content).map(([mediaType, value]) => [
        mediaType,
        context.trace(mediaType, () => (0, exports.toMediaTypeItemV3)({
            mediaTypeItem: value,
            mediaType,
            context
        }))
    ]));
};
exports.toMediaTypeItemsV3 = toMediaTypeItemsV3;
const toOptionalMediaTypeItemsV3 = ({ content, context }) => {
    if (!content) {
        return;
    }
    return (0, exports.toMediaTypeItemsV3)({ content, context });
};
exports.toOptionalMediaTypeItemsV3 = toOptionalMediaTypeItemsV3;
