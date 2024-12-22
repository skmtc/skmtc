import { toTagsV3 } from '../tag/toTagsV3.js';
import { toOperationsV3 } from '../operation/toOperationsV3.js';
import { toComponentsV3 } from '../components/toComponentsV3.js';
import { toInfoV3 } from '../info/toInfoV3.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toDocumentFieldsV3 = ({ documentObject, context }) => {
    const { openapi, info, paths, components, tags, ...skipped } = documentObject;
    const extensionFields = toSpecificationExtensionsV3({
        skipped,
        context
    });
    const fields = {
        openapi,
        info: context.trace('info', () => toInfoV3({ info, context })),
        operations: context.trace('paths', () => toOperationsV3({ paths, context })),
        components: context.trace('components', () => toComponentsV3({ components, context })),
        tags: context.trace('tags', () => toTagsV3({ tags, context })),
        extensionFields
    };
    return fields;
};
