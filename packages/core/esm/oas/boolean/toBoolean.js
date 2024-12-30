import { OasBoolean } from './Boolean.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toBoolean = ({ value, context }) => {
    const { type: _type, title, description, nullable, example, ...skipped } = value;
    const extensionFields = toSpecificationExtensionsV3({ skipped, context });
    return new OasBoolean({
        nullable,
        title,
        description,
        example,
        extensionFields
    });
};
