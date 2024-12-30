"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDocumentFieldsV3 = void 0;
const toTagsV3_js_1 = require("../tag/toTagsV3.js");
const toOperationsV3_js_1 = require("../operation/toOperationsV3.js");
const toComponentsV3_js_1 = require("../components/toComponentsV3.js");
const toInfoV3_js_1 = require("../info/toInfoV3.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toDocumentFieldsV3 = ({ documentObject, context }) => {
    const { openapi, info, paths, components, tags, ...skipped } = documentObject;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({
        skipped,
        context
    });
    const fields = {
        openapi,
        info: context.trace('info', () => (0, toInfoV3_js_1.toInfoV3)({ info, context })),
        operations: context.trace('paths', () => (0, toOperationsV3_js_1.toOperationsV3)({ paths, context })),
        components: context.trace('components', () => (0, toComponentsV3_js_1.toComponentsV3)({ components, context })),
        tags: context.trace('tags', () => (0, toTagsV3_js_1.toTagsV3)({ tags, context })),
        extensionFields
    };
    return fields;
};
exports.toDocumentFieldsV3 = toDocumentFieldsV3;
