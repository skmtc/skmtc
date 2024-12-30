import { isRef } from '../../helpers/refFns.js';
import { toRefV31 } from '../ref/toRefV31.js';
import { toMediaTypeItemsV3 } from '../mediaType/toMediaTypeItemV3.js';
import { OasRequestBody } from './RequestBody.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toRequestBodyV3 = ({ requestBody, context }) => {
    if (!requestBody) {
        return undefined;
    }
    if (isRef(requestBody)) {
        return toRefV31({ ref: requestBody, refType: 'requestBody', context });
    }
    const { description, content, required, ...skipped } = requestBody;
    const extensionFields = toSpecificationExtensionsV3({
        skipped,
        context
    });
    const fields = {
        description,
        content: context.trace('content', () => {
            return toMediaTypeItemsV3({ content, context });
        }),
        required,
        extensionFields
    };
    return new OasRequestBody(fields);
};
export const toRequestBodiesV3 = ({ requestBodies, context }) => {
    if (!requestBodies) {
        return undefined;
    }
    const entries = Object.entries(requestBodies)
        .map(([key, value]) => {
        return [key, context.trace(key, () => toRequestBodyV3({ requestBody: value, context }))];
    })
        .filter(([, value]) => Boolean(value));
    return Object.fromEntries(entries);
};
