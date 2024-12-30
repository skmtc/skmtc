"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toString = void 0;
const String_js_1 = require("./String.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const string_types_js_1 = require("./string-types.js");
const toString = ({ value, context }) => {
    const { type: _type, title, description, enum: enums, nullable, example, format, maxLength, minLength, ...skipped } = string_types_js_1.oasStringData.parse(value);
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({
        skipped,
        context
    });
    if (format && !string_types_js_1.stringFormat.safeParse(format).success) {
        context.logger.warn(`Invalid format: ${format}`);
    }
    if (enums?.length) {
        const { stackTrail } = context.stackTrail.clone();
        const lastFrame = stackTrail[stackTrail.length - 1];
        const parentObject = stackTrail[stackTrail.length - 2];
        if (typeof lastFrame === 'string' && parentObject === 'schemas') {
            enums.forEach(enumValue => {
                context.registerExtension({
                    extensionFields: {
                        Label: ''
                    },
                    stackTrail: ['models', lastFrame, enumValue],
                    type: 'string'
                });
            });
        }
    }
    return new String_js_1.OasString({
        title,
        description,
        enums,
        nullable,
        example,
        format,
        maxLength,
        minLength,
        extensionFields
    });
};
exports.toString = toString;
