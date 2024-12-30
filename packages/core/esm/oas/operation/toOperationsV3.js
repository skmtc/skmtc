import { toRequestBodyV3 } from '../requestBody/toRequestBodiesV3.js';
import { toResponsesV3 } from '../response/toResponseV3.js';
import { toParameterListV3 } from '../parameter/toParameterV3.js';
import { OasOperation } from './Operation.js';
import { toPathItemV3 } from '../pathItem/toPathItemV3.js';
import { methodValues } from '../../types/Method.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toOperationV3 = ({ operation, operationInfo, context }) => {
    const { method, path, pathItem } = operationInfo;
    const { operationId, tags, summary, description, parameters, requestBody, responses, deprecated, ...skipped } = operation;
    const extensionFields = toSpecificationExtensionsV3({ skipped, context });
    context.registerExtension({
        extensionFields: {
            Label: extensionFields?.['x-label'] ?? '',
            Description: extensionFields?.['x-description'] ?? ''
        },
        type: 'operation',
        stackTrail: ['operations', `${method.toUpperCase()} ${path}`]
    });
    return new OasOperation({
        pathItem,
        path,
        method,
        operationId,
        summary,
        tags,
        description,
        parameters: context.trace('parameters', () => toParameterListV3({ parameters, context })),
        requestBody: context.trace('requestBody', () => toRequestBodyV3({ requestBody, context })),
        responses: context.trace('responses', () => toResponsesV3({ responses, context })),
        deprecated,
        extensionFields
    });
};
export const toOperationsV3 = ({ paths, context }) => {
    return Object.entries(paths).flatMap(([path, pathItem]) => {
        return context.trace(path, () => {
            if (!pathItem) {
                return [];
            }
            const cleaned = Object.entries(pathItem).reduce(({ rest, methodObject }, [key, operation]) => {
                const isMethod = methodValues.includes(key);
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
            const pathItemObject = toPathItemV3({ pathItem: cleaned.rest, context });
            return Object.entries(cleaned.methodObject)
                .map(([method, operation]) => {
                return context.trace(method, () => {
                    if (!operation) {
                        return;
                    }
                    return toOperationV3({
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
