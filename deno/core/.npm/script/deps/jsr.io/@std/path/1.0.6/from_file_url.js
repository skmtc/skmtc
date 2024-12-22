"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromFileUrl = fromFileUrl;
const _os_js_1 = require("./_os.js");
const from_file_url_js_1 = require("./posix/from_file_url.js");
const from_file_url_js_2 = require("./windows/from_file_url.js");
/**
 * Converts a file URL to a path string.
 *
 * @example Usage
 * ```ts
 * import { fromFileUrl } from "@std/path/from-file-url";
 * import { assertEquals } from "@std/assert";
 *
 * if (Deno.build.os === "windows") {
 *   assertEquals(fromFileUrl("file:///home/foo"), "\\home\\foo");
 *   assertEquals(fromFileUrl("file:///C:/Users/foo"), "C:\\Users\\foo");
 *   assertEquals(fromFileUrl("file://localhost/home/foo"), "\\home\\foo");
 * } else {
 *   assertEquals(fromFileUrl("file:///home/foo"), "/home/foo");
 * }
 * ```
 *
 * @param url The file URL to convert to a path.
 * @returns The path string.
 */
function fromFileUrl(url) {
    return _os_js_1.isWindows ? (0, from_file_url_js_2.fromFileUrl)(url) : (0, from_file_url_js_1.fromFileUrl)(url);
}
