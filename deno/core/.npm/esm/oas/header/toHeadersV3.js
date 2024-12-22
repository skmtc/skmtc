import { toExamplesV3 } from '../example/toExamplesV3.js';
import { toRefV31 } from '../ref/toRefV31.js';
import { toOptionalSchemaV3 } from '../schema/toSchemasV3.js';
import { isRef } from '../../helpers/refFns.js';
import { toOptionalMediaTypeItemsV3 } from '../mediaType/toMediaTypeItemV3.js';
import { OasHeader } from './Header.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toHeadersV3 = ({ headers, context }) => {
    if (!headers) {
        return undefined;
    }
    return Object.fromEntries(Object.entries(headers).map(([key, value]) => {
        return [key, context.trace(key, () => toHeaderV3({ header: value, context }))];
    }));
};
const toHeaderV3 = ({ header, context }) => {
    if (isRef(header)) {
        return toRefV31({ ref: header, refType: 'header', context });
    }
    const { description, required, deprecated, schema, example, examples, content, ...skipped } = header;
    const extensionFields = toSpecificationExtensionsV3({ skipped, context });
    const fields = {
        description,
        required,
        deprecated,
        schema: context.trace('schema', () => toOptionalSchemaV3({ schema, context })),
        examples: toExamplesV3({
            examples,
            example,
            exampleKey: `TEMP`,
            context
        }),
        content: context.trace('content', () => toOptionalMediaTypeItemsV3({ content, context })),
        extensionFields
    };
    return new OasHeader(fields);
};
