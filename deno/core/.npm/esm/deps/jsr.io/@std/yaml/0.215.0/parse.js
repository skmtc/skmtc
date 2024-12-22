// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { load, loadAll } from "./_loader/loader.js";
/**
 * Parses `content` as single YAML document.
 *
 * Returns a JavaScript object or throws `YAMLError` on error.
 * By default, does not support regexps, functions and undefined. This method is safe for untrusted data.
 */
export function parse(content, options) {
    return load(content, options);
}
export function parseAll(content, iterator, options) {
    return loadAll(content, iterator, options);
}
