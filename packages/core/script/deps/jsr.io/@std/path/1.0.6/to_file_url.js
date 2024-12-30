"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.toFileUrl = toFileUrl;
const _os_js_1 = require("./_os.js");
const to_file_url_js_1 = require("./posix/to_file_url.js");
const to_file_url_js_2 = require("./windows/to_file_url.js");
/**
 * Converts a path string to a file URL.
 *
 * @example Usage
 * ```ts
 * import { toFileUrl } from "@std/path/to-file-url";
 * import { assertEquals } from "@std/assert";
 *
 * if (Deno.build.os === "windows") {
 *   assertEquals(toFileUrl("\\home\\foo"), new URL("file:///home/foo"));
 *   assertEquals(toFileUrl("C:\\Users\\foo"), new URL("file:///C:/Users/foo"));
 *   assertEquals(toFileUrl("\\\\127.0.0.1\\home\\foo"), new URL("file://127.0.0.1/home/foo"));
 * } else {
 *   assertEquals(toFileUrl("/home/foo"), new URL("file:///home/foo"));
 * }
 * ```
 *
 * @param path Path to convert to file URL.
 * @returns The file URL equivalent to the path.
 */
function toFileUrl(path) {
    return _os_js_1.isWindows ? (0, to_file_url_js_2.toFileUrl)(path) : (0, to_file_url_js_1.toFileUrl)(path);
}
