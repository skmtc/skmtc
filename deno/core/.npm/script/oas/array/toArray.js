"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toArray = void 0;
const Array_js_1 = require("./Array.js");
const toSchemasV3_js_1 = require("../schema/toSchemasV3.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toArray = ({ value, context }) => {
    const { type: _type, items, title, description, nullable, uniqueItems, example, ...skipped } = value;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({ skipped, context });
    return new Array_js_1.OasArray({
        title,
        description,
        nullable,
        uniqueItems,
        items: context.trace('items', () => (0, toSchemasV3_js_1.toSchemaV3)({ schema: items, context })),
        extensionFields,
        example
    });
};
exports.toArray = toArray;
