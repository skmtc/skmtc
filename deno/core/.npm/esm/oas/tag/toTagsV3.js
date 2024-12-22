import { OasTag } from './Tag.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toTagsV3 = ({ tags, context }) => {
    if (!tags) {
        return undefined;
    }
    return tags.map(tag => toTagV3({ tag, context }));
};
export const toTagV3 = ({ tag, context }) => {
    const { name, description, ...skipped } = tag;
    const extensionFields = toSpecificationExtensionsV3({
        skipped,
        context
    });
    const fields = {
        name,
        description,
        extensionFields
    };
    return new OasTag(fields);
};
