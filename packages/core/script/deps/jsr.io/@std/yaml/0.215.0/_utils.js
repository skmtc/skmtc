"use strict";
// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNothing = isNothing;
exports.isArray = isArray;
exports.isBoolean = isBoolean;
exports.isNull = isNull;
exports.isNumber = isNumber;
exports.isString = isString;
exports.isSymbol = isSymbol;
exports.isUndefined = isUndefined;
exports.isObject = isObject;
exports.isError = isError;
exports.isFunction = isFunction;
exports.isRegExp = isRegExp;
exports.toArray = toArray;
exports.repeat = repeat;
exports.isNegativeZero = isNegativeZero;
function isNothing(subject) {
    return typeof subject === "undefined" || subject === null;
}
function isArray(value) {
    return Array.isArray(value);
}
function isBoolean(value) {
    return typeof value === "boolean" || value instanceof Boolean;
}
function isNull(value) {
    return value === null;
}
function isNumber(value) {
    return typeof value === "number" || value instanceof Number;
}
function isString(value) {
    return typeof value === "string" || value instanceof String;
}
function isSymbol(value) {
    return typeof value === "symbol";
}
function isUndefined(value) {
    return value === undefined;
}
function isObject(value) {
    return value !== null && typeof value === "object";
}
function isError(e) {
    return e instanceof Error;
}
function isFunction(value) {
    return typeof value === "function";
}
function isRegExp(value) {
    return value instanceof RegExp;
}
function toArray(sequence) {
    if (isArray(sequence))
        return sequence;
    if (isNothing(sequence))
        return [];
    return [sequence];
}
function repeat(str, count) {
    let result = "";
    for (let cycle = 0; cycle < count; cycle++) {
        result += str;
    }
    return result;
}
function isNegativeZero(i) {
    return i === 0 && Number.NEGATIVE_INFINITY === 1 / i;
}
