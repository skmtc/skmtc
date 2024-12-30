"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.keyValues = void 0;
const constants_js_1 = require("../dsl/constants.js");
// Filter out properties with falsy or EMPTY values and return as joined string
const keyValues = (properties) => {
    const filteredEntries = Object.entries(properties)
        .map(([key, value]) => {
        const renderedValue = value?.toString() || constants_js_1.EMPTY;
        return renderedValue === constants_js_1.EMPTY ? constants_js_1.EMPTY : `${key}: ${renderedValue}`;
    })
        .filter(row => row !== constants_js_1.EMPTY);
    return filteredEntries.length ? `{${filteredEntries.join(',\n')}}` : constants_js_1.EMPTY;
};
exports.keyValues = keyValues;
