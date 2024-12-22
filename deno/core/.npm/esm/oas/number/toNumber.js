import { OasNumber } from './Number.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toNumber = ({ value, context }) => {
    const { type: _type, title, description, nullable, example, ...skipped } = value;
    const extensionFields = toSpecificationExtensionsV3({
        skipped,
        context
    });
    return new OasNumber({
        title,
        description,
        nullable,
        extensionFields,
        example
    });
};
