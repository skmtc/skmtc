"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMethod = exports.methods = exports.method = exports.methodValuesNoTrace = exports.methodValues = void 0;
require("../_dnt.polyfills.js");
const zod_1 = require("zod");
exports.methodValues = [
    'get',
    'put',
    'post',
    'delete',
    'options',
    'head',
    'patch',
    'trace'
];
exports.methodValuesNoTrace = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch'];
exports.method = zod_1.z
    .enum(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'])
    .openapi('Method');
exports.methods = zod_1.z.array(exports.method);
const isMethod = (arg) => {
    return exports.method.safeParse(arg).success;
};
exports.isMethod = isMethod;
