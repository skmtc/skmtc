"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromFileUrl = fromFileUrl;
const from_file_url_js_1 = require("../_common/from_file_url.js");
/**
 * Converts a file URL to a path string.
 *
 * @example Usage
 * ```ts
 * import { fromFileUrl } from "@std/path/posix/from-file-url";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(fromFileUrl(new URL("file:///home/foo")), "/home/foo");
 * ```
 *
 * @param url The file URL to convert.
 * @returns The path string.
 */
function fromFileUrl(url) {
    url = (0, from_file_url_js_1.assertArg)(url);
    return decodeURIComponent(url.pathname.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
}
