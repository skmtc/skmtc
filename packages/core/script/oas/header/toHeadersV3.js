"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toHeadersV3 = void 0;
const toExamplesV3_js_1 = require("../example/toExamplesV3.js");
const toRefV31_js_1 = require("../ref/toRefV31.js");
const toSchemasV3_js_1 = require("../schema/toSchemasV3.js");
const refFns_js_1 = require("../../helpers/refFns.js");
const toMediaTypeItemV3_js_1 = require("../mediaType/toMediaTypeItemV3.js");
const Header_js_1 = require("./Header.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toHeadersV3 = ({ headers, context }) => {
    if (!headers) {
        return undefined;
    }
    return Object.fromEntries(Object.entries(headers).map(([key, value]) => {
        return [key, context.trace(key, () => toHeaderV3({ header: value, context }))];
    }));
};
exports.toHeadersV3 = toHeadersV3;
const toHeaderV3 = ({ header, context }) => {
    if ((0, refFns_js_1.isRef)(header)) {
        return (0, toRefV31_js_1.toRefV31)({ ref: header, refType: 'header', context });
    }
    const { description, required, deprecated, schema, example, examples, content, ...skipped } = header;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({ skipped, context });
    const fields = {
        description,
        required,
        deprecated,
        schema: context.trace('schema', () => (0, toSchemasV3_js_1.toOptionalSchemaV3)({ schema, context })),
        examples: (0, toExamplesV3_js_1.toExamplesV3)({
            examples,
            example,
            exampleKey: `TEMP`,
            context
        }),
        content: context.trace('content', () => (0, toMediaTypeItemV3_js_1.toOptionalMediaTypeItemsV3)({ content, context })),
        extensionFields
    };
    return new Header_js_1.OasHeader(fields);
};
