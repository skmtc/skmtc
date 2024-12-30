import { toParameterListV3 } from '../parameter/toParameterV3.js';
import { OasPathItem } from './PathItem.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toPathItemV3 = ({ pathItem, context }) => {
    const { summary, description, parameters, ...skipped } = pathItem;
    return new OasPathItem({
        summary,
        description,
        parameters: context.trace('parameters', () => toParameterListV3({ parameters, context })),
        extensionFields: toSpecificationExtensionsV3({ skipped, context })
    });
};
