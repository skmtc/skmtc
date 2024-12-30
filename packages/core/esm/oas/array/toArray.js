import { OasArray } from './Array.js';
import { toSchemaV3 } from '../schema/toSchemasV3.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toArray = ({ value, context }) => {
    const { type: _type, items, title, description, nullable, uniqueItems, example, ...skipped } = value;
    const extensionFields = toSpecificationExtensionsV3({ skipped, context });
    return new OasArray({
        title,
        description,
        nullable,
        uniqueItems,
        items: context.trace('items', () => toSchemaV3({ schema: items, context })),
        extensionFields,
        example
    });
};
