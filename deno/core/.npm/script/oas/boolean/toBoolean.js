"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toBoolean = void 0;
const Boolean_js_1 = require("./Boolean.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toBoolean = ({ value, context }) => {
    const { type: _type, title, description, nullable, example, ...skipped } = value;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({ skipped, context });
    return new Boolean_js_1.OasBoolean({
        nullable,
        title,
        description,
        example,
        extensionFields
    });
};
exports.toBoolean = toBoolean;
