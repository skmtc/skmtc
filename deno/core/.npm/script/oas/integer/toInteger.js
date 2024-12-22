"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toInteger = void 0;
const Integer_js_1 = require("./Integer.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const integer_types_js_1 = require("./integer-types.js");
const toInteger = ({ value, context }) => {
    const { type: _type, title, description, nullable, format, enum: enums, example, ...skipped } = integer_types_js_1.oasIntegerData.parse(value);
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({ skipped, context });
    return new Integer_js_1.OasInteger({
        title,
        description,
        nullable,
        format,
        enums,
        extensionFields,
        example
    });
};
exports.toInteger = toInteger;
