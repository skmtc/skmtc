"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toOperationsV3 = exports.toOperationV3 = void 0;
const toRequestBodiesV3_js_1 = require("../requestBody/toRequestBodiesV3.js");
const toResponseV3_js_1 = require("../response/toResponseV3.js");
const toParameterV3_js_1 = require("../parameter/toParameterV3.js");
const Operation_js_1 = require("./Operation.js");
const toPathItemV3_js_1 = require("../pathItem/toPathItemV3.js");
const Method_js_1 = require("../../types/Method.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toOperationV3 = ({ operation, operationInfo, context }) => {
    const { method, path, pathItem } = operationInfo;
    const { operationId, tags, summary, description, parameters, requestBody, responses, deprecated, ...skipped } = operation;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({ skipped, context });
    context.registerExtension({
        extensionFields: {
            Label: extensionFields?.['x-label'] ?? '',
            Description: extensionFields?.['x-description'] ?? ''
        },
        type: 'operation',
        stackTrail: ['operations', `${method.toUpperCase()} ${path}`]
    });
    return new Operation_js_1.OasOperation({
        pathItem,
        path,
        method,
        operationId,
        summary,
        tags,
        description,
        parameters: context.trace('parameters', () => (0, toParameterV3_js_1.toParameterListV3)({ parameters, context })),
        requestBody: context.trace('requestBody', () => (0, toRequestBodiesV3_js_1.toRequestBodyV3)({ requestBody, context })),
        responses: context.trace('responses', () => (0, toResponseV3_js_1.toResponsesV3)({ responses, context })),
        deprecated,
        extensionFields
    });
};
exports.toOperationV3 = toOperationV3;
const toOperationsV3 = ({ paths, context }) => {
    return Object.entries(paths).flatMap(([path, pathItem]) => {
        return context.trace(path, () => {
            if (!pathItem) {
                return [];
            }
            const cleaned = Object.entries(pathItem).reduce(({ rest, methodObject }, [key, operation]) => {
                const isMethod = Method_js_1.methodValues.includes(key);
                if (isMethod) {
                    const { [key]: _deleted, ...remaining } = rest;
                    return {
                        rest: remaining,
                        methodObject: {
                            ...methodObject,
                            [key]: operation
                        }
                    };
                }
                return { rest, methodObject };
            }, {
                rest: pathItem,
                methodObject: {}
            });
            const pathItemObject = (0, toPathItemV3_js_1.toPathItemV3)({ pathItem: cleaned.rest, context });
            return Object.entries(cleaned.methodObject)
                .map(([method, operation]) => {
                return context.trace(method, () => {
                    if (!operation) {
                        return;
                    }
                    return (0, exports.toOperationV3)({
                        operation,
                        operationInfo: {
                            method: method,
                            path,
                            pathItem: pathItemObject
                        },
                        context
                    });
                });
            })
                .filter((item) => Boolean(item));
        });
    });
};
exports.toOperationsV3 = toOperationsV3;
