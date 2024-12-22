"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRef = exports.toRefName = void 0;
const toRefName = ($ref) => {
    // TODO: Add validation here to ensure reference exists
    const refName = $ref.split('/').slice(-1)[0];
    if (!refName) {
        throw new Error('Invalid reference');
    }
    return refName;
};
exports.toRefName = toRefName;
const isRef = (value) => {
    if (value &&
        typeof value === 'object' &&
        '$ref' in value &&
        typeof value.$ref === 'string') {
        return true;
    }
    else {
        return false;
    }
};
exports.isRef = isRef;
