"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toNumber = void 0;
const Number_js_1 = require("./Number.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toNumber = ({ value, context }) => {
    const { type: _type, title, description, nullable, example, ...skipped } = value;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({
        skipped,
        context
    });
    return new Number_js_1.OasNumber({
        title,
        description,
        nullable,
        extensionFields,
        example
    });
};
exports.toNumber = toNumber;
