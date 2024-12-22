"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toResponseV3 = exports.toOptionalResponsesV3 = exports.toResponsesV3 = void 0;
const toRefV31_js_1 = require("../ref/toRefV31.js");
const toHeadersV3_js_1 = require("../header/toHeadersV3.js");
const refFns_js_1 = require("../../helpers/refFns.js");
const toMediaTypeItemV3_js_1 = require("../mediaType/toMediaTypeItemV3.js");
const Response_js_1 = require("./Response.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toResponsesV3 = ({ responses, context }) => {
    return Object.fromEntries(Object.entries(responses).map(([key, value]) => {
        return [key, context.trace(key, () => (0, exports.toResponseV3)({ response: value, context }))];
    }));
};
exports.toResponsesV3 = toResponsesV3;
const toOptionalResponsesV3 = ({ responses, context }) => {
    if (!responses) {
        return undefined;
    }
    return (0, exports.toResponsesV3)({ responses, context });
};
exports.toOptionalResponsesV3 = toOptionalResponsesV3;
const toResponseV3 = ({ response, context }) => {
    if ((0, refFns_js_1.isRef)(response)) {
        return (0, toRefV31_js_1.toRefV31)({ ref: response, refType: 'response', context });
    }
    const { description, headers, content, ...skipped } = response;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({
        skipped,
        context
    });
    const fields = {
        description,
        headers: context.trace('headers', () => (0, toHeadersV3_js_1.toHeadersV3)({ headers, context })),
        content: context.trace('content', () => (0, toMediaTypeItemV3_js_1.toOptionalMediaTypeItemsV3)({ content, context })),
        extensionFields
    };
    return new Response_js_1.OasResponse(fields);
};
exports.toResponseV3 = toResponseV3;
