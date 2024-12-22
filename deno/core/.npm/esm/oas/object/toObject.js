import { OasObject } from './Object.js';
import { toOptionalSchemasV3 } from '../schema/toSchemasV3.js';
import { toAdditionalPropertiesV3 } from './toAdditionalPropertiesV3.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toObject = ({ value, context }) => {
    const { type: _type, title, description, properties, required, additionalProperties, nullable, example, ...skipped } = value;
    const extensionFields = toSpecificationExtensionsV3({
        skipped,
        context
    });
    const fields = {
        title,
        description,
        nullable,
        example,
        properties: context.trace('properties', () => toOptionalSchemasV3({
            schemas: properties,
            context
        })),
        required: required,
        additionalProperties: context.trace('additionalProperties', () => toAdditionalPropertiesV3({ additionalProperties, context })),
        extensionFields
    };
    return new OasObject(fields);
};
