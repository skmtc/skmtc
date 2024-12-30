"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPathTemplate = void 0;
const toPathTemplate = (path, queryArg) => {
    return `${path.replaceAll(/{([^}]*)}/g, queryArg ? '${' + queryArg + '.$1}' : '${$1}')}`;
};
exports.toPathTemplate = toPathTemplate;
