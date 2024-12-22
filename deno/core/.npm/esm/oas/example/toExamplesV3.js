import { isRef } from '../../helpers/refFns.js';
import { toRefV31 } from '../ref/toRefV31.js';
import { OasExample } from './Example.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toExampleSimpleV3 = ({ example }) => {
    const fields = {
        value: example,
        summary: undefined,
        description: undefined
    };
    return new OasExample(fields);
};
export const toExamplesV3 = ({ example, examples, exampleKey, context }) => {
    if (example && examples) {
        context.logger.warn(`Both example and examples are defined for ${exampleKey}`);
    }
    if (example) {
        return {
            [exampleKey]: context.trace('example', () => toExampleSimpleV3({ example }))
        };
    }
    if (examples) {
        context.trace('examples', () => {
            return Object.fromEntries(Object.entries(examples).map(([key, value]) => {
                return [key, context.trace(key, () => toExampleV3({ example: value, context }))];
            }));
        });
    }
    return undefined;
};
export const toExampleV3 = ({ example, context }) => {
    if (isRef(example)) {
        return toRefV31({ ref: example, refType: 'example', context });
    }
    const { summary, description, value, ...skipped } = example;
    const extensionFields = toSpecificationExtensionsV3({ skipped, context });
    return new OasExample({
        summary,
        description,
        value,
        extensionFields
    });
};
