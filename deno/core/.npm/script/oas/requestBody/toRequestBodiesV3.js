"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toRequestBodiesV3 = exports.toRequestBodyV3 = void 0;
const refFns_js_1 = require("../../helpers/refFns.js");
const toRefV31_js_1 = require("../ref/toRefV31.js");
const toMediaTypeItemV3_js_1 = require("../mediaType/toMediaTypeItemV3.js");
const RequestBody_js_1 = require("./RequestBody.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toRequestBodyV3 = ({ requestBody, context }) => {
    if (!requestBody) {
        return undefined;
    }
    if ((0, refFns_js_1.isRef)(requestBody)) {
        return (0, toRefV31_js_1.toRefV31)({ ref: requestBody, refType: 'requestBody', context });
    }
    const { description, content, required, ...skipped } = requestBody;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({
        skipped,
        context
    });
    const fields = {
        description,
        content: context.trace('content', () => {
            return (0, toMediaTypeItemV3_js_1.toMediaTypeItemsV3)({ content, context });
        }),
        required,
        extensionFields
    };
    return new RequestBody_js_1.OasRequestBody(fields);
};
exports.toRequestBodyV3 = toRequestBodyV3;
const toRequestBodiesV3 = ({ requestBodies, context }) => {
    if (!requestBodies) {
        return undefined;
    }
    const entries = Object.entries(requestBodies)
        .map(([key, value]) => {
        return [key, context.trace(key, () => (0, exports.toRequestBodyV3)({ requestBody: value, context }))];
    })
        .filter(([, value]) => Boolean(value));
    return Object.fromEntries(entries);
};
exports.toRequestBodiesV3 = toRequestBodiesV3;
