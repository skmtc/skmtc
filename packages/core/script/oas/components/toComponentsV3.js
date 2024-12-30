"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toComponentsV3 = void 0;
const toResponseV3_js_1 = require("../response/toResponseV3.js");
const toHeadersV3_js_1 = require("../header/toHeadersV3.js");
const toSchemasV3_js_1 = require("../schema/toSchemasV3.js");
const toParameterV3_js_1 = require("../parameter/toParameterV3.js");
const toExamplesV3_js_1 = require("../example/toExamplesV3.js");
const toRequestBodiesV3_js_1 = require("../requestBody/toRequestBodiesV3.js");
const Components_js_1 = require("./Components.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toComponentsV3 = ({ components, context }) => {
    if (!components) {
        return undefined;
    }
    const { schemas, responses, parameters, examples, requestBodies, headers, ...skipped } = components;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({ skipped, context });
    const fields = {
        schemas: context.trace('schemas', () => (0, toSchemasV3_js_1.toOptionalSchemasV3)({ schemas, context, childOfComponents: true })),
        responses: context.trace('responses', () => (0, toResponseV3_js_1.toOptionalResponsesV3)({ responses, context })),
        parameters: context.trace('parameters', () => (0, toParameterV3_js_1.toOptionalParametersV3)({
            parameters,
            context
        })),
        examples: (0, toExamplesV3_js_1.toExamplesV3)({
            examples,
            example: undefined,
            exampleKey: 'TEMP',
            context
        }),
        requestBodies: context.trace('requestBodies', () => (0, toRequestBodiesV3_js_1.toRequestBodiesV3)({ requestBodies, context })),
        headers: context.trace('headers', () => (0, toHeadersV3_js_1.toHeadersV3)({ headers, context })),
        extensionFields
    };
    return new Components_js_1.OasComponents(fields);
};
exports.toComponentsV3 = toComponentsV3;
