import { toRefV31 } from '../ref/toRefV31.js';
import { toHeadersV3 } from '../header/toHeadersV3.js';
import { isRef } from '../../helpers/refFns.js';
import { toOptionalMediaTypeItemsV3 } from '../mediaType/toMediaTypeItemV3.js';
import { OasResponse } from './Response.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toResponsesV3 = ({ responses, context }) => {
    return Object.fromEntries(Object.entries(responses).map(([key, value]) => {
        return [key, context.trace(key, () => toResponseV3({ response: value, context }))];
    }));
};
export const toOptionalResponsesV3 = ({ responses, context }) => {
    if (!responses) {
        return undefined;
    }
    return toResponsesV3({ responses, context });
};
export const toResponseV3 = ({ response, context }) => {
    if (isRef(response)) {
        return toRefV31({ ref: response, refType: 'response', context });
    }
    const { description, headers, content, ...skipped } = response;
    const extensionFields = toSpecificationExtensionsV3({
        skipped,
        context
    });
    const fields = {
        description,
        headers: context.trace('headers', () => toHeadersV3({ headers, context })),
        content: context.trace('content', () => toOptionalMediaTypeItemsV3({ content, context })),
        extensionFields
    };
    return new OasResponse(fields);
};
