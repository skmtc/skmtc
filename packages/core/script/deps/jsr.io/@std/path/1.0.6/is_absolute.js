"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAbsolute = isAbsolute;
const _os_js_1 = require("./_os.js");
const is_absolute_js_1 = require("./posix/is_absolute.js");
const is_absolute_js_2 = require("./windows/is_absolute.js");
/**
 * Verifies whether provided path is absolute.
 *
 * @example Usage
 * ```ts
 * import { isAbsolute } from "@std/path/is-absolute";
 * import { assert, assertFalse } from "@std/assert";
 *
 * if (Deno.build.os === "windows") {
 *   assert(isAbsolute("C:\\home\\foo"));
 *   assertFalse(isAbsolute("home\\foo"));
 * } else {
 *   assert(isAbsolute("/home/foo"));
 *   assertFalse(isAbsolute("home/foo"));
 * }
 * ```
 *
 * @param path Path to be verified as absolute.
 * @returns `true` if path is absolute, `false` otherwise
 */
function isAbsolute(path) {
    return _os_js_1.isWindows ? (0, is_absolute_js_2.isAbsolute)(path) : (0, is_absolute_js_1.isAbsolute)(path);
}
