"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromGeneratorKey = exports.toGeneratorId = exports.isGeneratorOnlyKey = exports.isModelGeneratorKey = exports.isOperationGeneratorKey = exports.isGeneratorKey = exports.toGeneratorOnlyKey = exports.toModelGeneratorKey = exports.toOperationGeneratorKey = void 0;
require("../_dnt.polyfills.js");
const Method_js_1 = require("./Method.js");
const toOperationGeneratorKey = ({ generatorId, ...rest }) => {
    const { path, method } = 'operation' in rest ? rest.operation : rest;
    const nakedKey = `${generatorId}|${path}|${method}`;
    return nakedKey;
};
exports.toOperationGeneratorKey = toOperationGeneratorKey;
const toModelGeneratorKey = ({ generatorId, refName }) => {
    const nakedKey = `${generatorId}|${refName}`;
    return nakedKey;
};
exports.toModelGeneratorKey = toModelGeneratorKey;
const toGeneratorOnlyKey = ({ generatorId }) => {
    const nakedKey = `${generatorId}`;
    return nakedKey;
};
exports.toGeneratorOnlyKey = toGeneratorOnlyKey;
const isGeneratorKey = (arg) => {
    return ((0, exports.isModelGeneratorKey)(arg) ||
        (0, exports.isOperationGeneratorKey)(arg) ||
        (0, exports.isGeneratorOnlyKey)(arg));
};
exports.isGeneratorKey = isGeneratorKey;
const isOperationGeneratorKey = (arg) => {
    if (typeof arg !== 'string') {
        return false;
    }
    const keyTokens = arg.split('|');
    if (keyTokens.length !== 3) {
        return false;
    }
    const [generatorId, path, method] = keyTokens;
    if (typeof generatorId !== 'string' || !generatorId.length) {
        return false;
    }
    if (typeof path !== 'string' || !path.length) {
        return false;
    }
    if (!(0, Method_js_1.isMethod)(method)) {
        return false;
    }
    return true;
};
exports.isOperationGeneratorKey = isOperationGeneratorKey;
const isModelGeneratorKey = (arg) => {
    if (typeof arg !== 'string') {
        return false;
    }
    const keyTokens = arg.split('|');
    if (keyTokens.length !== 2) {
        return false;
    }
    const [generatorId, refName] = keyTokens;
    if (typeof generatorId !== 'string' || !generatorId.length) {
        return false;
    }
    if (typeof refName !== 'string' || !refName.length) {
        return false;
    }
    return true;
};
exports.isModelGeneratorKey = isModelGeneratorKey;
const isGeneratorOnlyKey = (arg) => {
    if (typeof arg !== 'string') {
        return false;
    }
    return Boolean(arg.length);
};
exports.isGeneratorOnlyKey = isGeneratorOnlyKey;
const toGeneratorId = (generatorKey) => {
    if ((0, exports.isOperationGeneratorKey)(generatorKey)) {
        return generatorKey.split('|')[0];
    }
    if ((0, exports.isModelGeneratorKey)(generatorKey)) {
        return generatorKey.split('|')[0];
    }
    return generatorKey;
};
exports.toGeneratorId = toGeneratorId;
const fromGeneratorKey = (generatorKey) => {
    if ((0, exports.isOperationGeneratorKey)(generatorKey)) {
        const [generatorId, path, method] = generatorKey.split('|');
        return { type: 'operation', generatorId, path, method: method };
    }
    if ((0, exports.isModelGeneratorKey)(generatorKey)) {
        const [generatorId, refName] = generatorKey.split('|');
        return { type: 'model', generatorId, refName };
    }
    return { type: 'generator-only', generatorId: generatorKey };
};
exports.fromGeneratorKey = fromGeneratorKey;
