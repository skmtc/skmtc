import { OasUnknown } from './Unknown.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toUnknown = ({ value, context }) => {
    const { type: _type, title, description, example, ...skipped } = value;
    const extensionFields = toSpecificationExtensionsV3({
        skipped,
        context
    });
    return new OasUnknown({
        title,
        description,
        extensionFields,
        example
    });
};
