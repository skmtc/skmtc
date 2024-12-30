import { OasString } from './String.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
import { oasStringData, stringFormat } from './string-types.js';
export const toString = ({ value, context }) => {
    const { type: _type, title, description, enum: enums, nullable, example, format, maxLength, minLength, ...skipped } = oasStringData.parse(value);
    const extensionFields = toSpecificationExtensionsV3({
        skipped,
        context
    });
    if (format && !stringFormat.safeParse(format).success) {
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
    return new OasString({
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
