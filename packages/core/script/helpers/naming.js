"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMethodVerb = exports.toArgsName = exports.toResponseName = exports.toEndpointName = exports.toEndpointType = void 0;
const lodash_es_1 = require("lodash-es");
const ts_pattern_1 = require("ts-pattern");
const toEndpointType = (operation) => {
    return operation.method === 'get' ? 'query' : 'mutation';
};
exports.toEndpointType = toEndpointType;
/** generates endpoint name in the `camelCase{method}Api{path}` format */
const toEndpointName = (operation) => {
    const { path, method } = operation;
    const verb = (0, exports.toMethodVerb)(method);
    return (0, lodash_es_1.camelCase)(`${verb}Api${path}`);
};
exports.toEndpointName = toEndpointName;
const toResponseName = (operation) => {
    const operationName = (0, exports.toEndpointName)(operation);
    return `${operationName}Response`;
};
exports.toResponseName = toResponseName;
const toArgsName = (operation) => {
    const operationName = (0, exports.toEndpointName)(operation);
    return `${operationName}Args`;
};
exports.toArgsName = toArgsName;
const toMethodVerb = (method) => {
    return (0, ts_pattern_1.match)(method)
        .with('post', () => 'Create')
        .with('put', () => 'Update')
        .otherwise(matched => matched);
};
exports.toMethodVerb = toMethodVerb;
