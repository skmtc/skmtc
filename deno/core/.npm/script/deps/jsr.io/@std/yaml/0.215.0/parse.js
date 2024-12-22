"use strict";
// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = parse;
exports.parseAll = parseAll;
const loader_js_1 = require("./_loader/loader.js");
/**
 * Parses `content` as single YAML document.
 *
 * Returns a JavaScript object or throws `YAMLError` on error.
 * By default, does not support regexps, functions and undefined. This method is safe for untrusted data.
 */
function parse(content, options) {
    return (0, loader_js_1.load)(content, options);
}
function parseAll(content, iterator, options) {
    return (0, loader_js_1.loadAll)(content, iterator, options);
}
