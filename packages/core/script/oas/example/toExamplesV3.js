"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toExampleV3 = exports.toExamplesV3 = exports.toExampleSimpleV3 = void 0;
const refFns_js_1 = require("../../helpers/refFns.js");
const toRefV31_js_1 = require("../ref/toRefV31.js");
const Example_js_1 = require("./Example.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toExampleSimpleV3 = ({ example }) => {
    const fields = {
        value: example,
        summary: undefined,
        description: undefined
    };
    return new Example_js_1.OasExample(fields);
};
exports.toExampleSimpleV3 = toExampleSimpleV3;
const toExamplesV3 = ({ example, examples, exampleKey, context }) => {
    if (example && examples) {
        context.logger.warn(`Both example and examples are defined for ${exampleKey}`);
    }
    if (example) {
        return {
            [exampleKey]: context.trace('example', () => (0, exports.toExampleSimpleV3)({ example }))
        };
    }
    if (examples) {
        context.trace('examples', () => {
            return Object.fromEntries(Object.entries(examples).map(([key, value]) => {
                return [key, context.trace(key, () => (0, exports.toExampleV3)({ example: value, context }))];
            }));
        });
    }
    return undefined;
};
exports.toExamplesV3 = toExamplesV3;
const toExampleV3 = ({ example, context }) => {
    if ((0, refFns_js_1.isRef)(example)) {
        return (0, toRefV31_js_1.toRefV31)({ ref: example, refType: 'example', context });
    }
    const { summary, description, value, ...skipped } = example;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({ skipped, context });
    return new Example_js_1.OasExample({
        summary,
        description,
        value,
        extensionFields
    });
};
exports.toExampleV3 = toExampleV3;
