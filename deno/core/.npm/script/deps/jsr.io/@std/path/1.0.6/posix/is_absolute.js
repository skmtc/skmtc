"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAbsolute = isAbsolute;
const assert_path_js_1 = require("../_common/assert_path.js");
const _util_js_1 = require("./_util.js");
/**
 * Verifies whether provided path is absolute.
 *
 * @example Usage
 * ```ts
 * import { isAbsolute } from "@std/path/posix/is-absolute";
 * import { assert, assertFalse } from "@std/assert";
 *
 * assert(isAbsolute("/home/user/Documents/"));
 * assertFalse(isAbsolute("home/user/Documents/"));
 * ```
 *
 * @param path The path to verify.
 * @returns Whether the path is absolute.
 */
function isAbsolute(path) {
    (0, assert_path_js_1.assertPath)(path);
    return path.length > 0 && (0, _util_js_1.isPosixPathSeparator)(path.charCodeAt(0));
}
