import "../_dnt.polyfills.js";
import { z } from 'zod';
export const methodValues = [
    'get',
    'put',
    'post',
    'delete',
    'options',
    'head',
    'patch',
    'trace'
];
export const methodValuesNoTrace = [
    'get',
    'put',
    'post',
    'delete',
    'options',
    'head',
    'patch'
];
export const method = z.enum([
    'get',
    'put',
    'post',
    'delete',
    'options',
    'head',
    'patch',
    'trace'
]);
export const methods = z.array(method);
export const isMethod = (arg) => {
    return method.safeParse(arg).success;
};
