"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isImported = void 0;
const mod_js_1 = require("../deps/jsr.io/@std/path/1.0.6/mod.js");
const isImported = (pathOne, pathTwo) => {
    return (0, mod_js_1.normalize)(pathOne) !== (0, mod_js_1.normalize)(pathTwo);
};
exports.isImported = isImported;
