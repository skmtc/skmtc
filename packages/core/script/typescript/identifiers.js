"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePropertyName = exports.handleKey = void 0;
const helper_validator_identifier_1 = require("@babel/helper-validator-identifier");
const handleKey = (key) => {
    return (0, helper_validator_identifier_1.isIdentifierName)(key) ? key : `'${key}'`;
};
exports.handleKey = handleKey;
const handlePropertyName = (name, parent) => {
    return (0, helper_validator_identifier_1.isIdentifierName)(name) ? `${parent}.${name}` : `${parent}['${name}']`;
};
exports.handlePropertyName = handlePropertyName;
