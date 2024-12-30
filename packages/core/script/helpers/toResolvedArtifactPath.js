"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toResolvedArtifactPath = void 0;
require("../_dnt.polyfills.js");
const mod_js_1 = require("../deps/jsr.io/@std/path/1.0.6/mod.js");
const toResolvedArtifactPath = ({ basePath, destinationPath }) => {
    return (0, mod_js_1.join)(basePath ?? 'dist', destinationPath.replace(/^@\//, ''));
};
exports.toResolvedArtifactPath = toResolvedArtifactPath;
