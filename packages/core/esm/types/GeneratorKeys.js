import "../_dnt.polyfills.js";
import { isMethod } from './Method.js';
export const toOperationGeneratorKey = ({ generatorId, ...rest }) => {
    const { path, method } = 'operation' in rest ? rest.operation : rest;
    const nakedKey = `${generatorId}|${path}|${method}`;
    return nakedKey;
};
export const toModelGeneratorKey = ({ generatorId, refName }) => {
    const nakedKey = `${generatorId}|${refName}`;
    return nakedKey;
};
export const toGeneratorOnlyKey = ({ generatorId }) => {
    const nakedKey = `${generatorId}`;
    return nakedKey;
};
export const isGeneratorKey = (arg) => {
    return (isModelGeneratorKey(arg) ||
        isOperationGeneratorKey(arg) ||
        isGeneratorOnlyKey(arg));
};
export const isOperationGeneratorKey = (arg) => {
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
    if (!isMethod(method)) {
        return false;
    }
    return true;
};
export const isModelGeneratorKey = (arg) => {
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
export const isGeneratorOnlyKey = (arg) => {
    if (typeof arg !== 'string') {
        return false;
    }
    return Boolean(arg.length);
};
export const toGeneratorId = (generatorKey) => {
    if (isOperationGeneratorKey(generatorKey)) {
        return generatorKey.split('|')[0];
    }
    if (isModelGeneratorKey(generatorKey)) {
        return generatorKey.split('|')[0];
    }
    return generatorKey;
};
export const fromGeneratorKey = (generatorKey) => {
    if (isOperationGeneratorKey(generatorKey)) {
        const [generatorId, path, method] = generatorKey.split('|');
        return { type: 'operation', generatorId, path, method: method };
    }
    if (isModelGeneratorKey(generatorKey)) {
        const [generatorId, refName] = generatorKey.split('|');
        return { type: 'model', generatorId, refName };
    }
    return { type: 'generator-only', generatorId: generatorKey };
};
