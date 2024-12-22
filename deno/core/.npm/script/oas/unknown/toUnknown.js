"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toUnknown = void 0;
const Unknown_js_1 = require("./Unknown.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toUnknown = ({ value, context }) => {
    const { type: _type, title, description, example, ...skipped } = value;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({
        skipped,
        context
    });
    return new Unknown_js_1.OasUnknown({
        title,
        description,
        extensionFields,
        example
    });
};
exports.toUnknown = toUnknown;
