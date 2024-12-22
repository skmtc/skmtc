import { camelCase } from 'lodash-es';
import { match } from 'ts-pattern';
export const toEndpointType = (operation) => {
    return operation.method === 'get' ? 'query' : 'mutation';
};
/** generates endpoint name in the `camelCase{method}Api{path}` format */
export const toEndpointName = (operation) => {
    const { path, method } = operation;
    const verb = toMethodVerb(method);
    return camelCase(`${verb}Api${path}`);
};
export const toResponseName = (operation) => {
    const operationName = toEndpointName(operation);
    return `${operationName}Response`;
};
export const toArgsName = (operation) => {
    const operationName = toEndpointName(operation);
    return `${operationName}Args`;
};
export const toMethodVerb = (method) => {
    return match(method)
        .with('post', () => 'Create')
        .with('put', () => 'Update')
        .otherwise(matched => matched);
};
