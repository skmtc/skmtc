"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.camelCase = exports.decapitalize = exports.capitalize = void 0;
require("../_dnt.polyfills.js");
const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};
exports.capitalize = capitalize;
const decapitalize = (str) => {
    return str.charAt(0).toLocaleLowerCase() + str.slice(1);
};
exports.decapitalize = decapitalize;
const camelCase = (str, { upperFirst } = {}) => {
    let doCapitalize = Boolean(upperFirst);
    const camelCased = str.replace(/[^a-zA-Z0-9]+([a-zA-Z0-9]+)/g, (_, matched) => {
        if (doCapitalize) {
            return (0, exports.capitalize)(matched);
        }
        doCapitalize = true;
        return matched;
    });
    const cleaned = camelCased.replaceAll(/[^a-z0-9]*/gi, '');
    return upperFirst ? (0, exports.capitalize)(cleaned) : cleaned;
};
exports.camelCase = camelCase;
