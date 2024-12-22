"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.toFileUrl = toFileUrl;
const to_file_url_js_1 = require("../_common/to_file_url.js");
const is_absolute_js_1 = require("./is_absolute.js");
/**
 * Converts a path string to a file URL.
 *
 * @example Usage
 * ```ts
 * import { toFileUrl } from "@std/path/posix/to-file-url";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(toFileUrl("/home/foo"), new URL("file:///home/foo"));
 * assertEquals(toFileUrl("/home/foo bar"), new URL("file:///home/foo%20bar"));
 * ```
 *
 * @param path The path to convert.
 * @returns The file URL.
 */
function toFileUrl(path) {
    if (!(0, is_absolute_js_1.isAbsolute)(path)) {
        throw new TypeError(`Path must be absolute: received "${path}"`);
    }
    const url = new URL("file:///");
    url.pathname = (0, to_file_url_js_1.encodeWhitespace)(path.replace(/%/g, "%25").replace(/\\/g, "%5C"));
    return url;
}
