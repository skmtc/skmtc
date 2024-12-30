"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toObject = void 0;
const Object_js_1 = require("./Object.js");
const toSchemasV3_js_1 = require("../schema/toSchemasV3.js");
const toAdditionalPropertiesV3_js_1 = require("./toAdditionalPropertiesV3.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toObject = ({ value, context }) => {
    const { type: _type, title, description, properties, required, additionalProperties, nullable, example, ...skipped } = value;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({
        skipped,
        context
    });
    const fields = {
        title,
        description,
        nullable,
        example,
        properties: context.trace('properties', () => (0, toSchemasV3_js_1.toOptionalSchemasV3)({
            schemas: properties,
            context
        })),
        required: required,
        additionalProperties: context.trace('additionalProperties', () => (0, toAdditionalPropertiesV3_js_1.toAdditionalPropertiesV3)({ additionalProperties, context })),
        extensionFields
    };
    return new Object_js_1.OasObject(fields);
};
exports.toObject = toObject;
