"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolve = resolve;
const _os_js_1 = require("./_os.js");
const resolve_js_1 = require("./posix/resolve.js");
const resolve_js_2 = require("./windows/resolve.js");
/**
 * Resolves path segments into a path.
 *
 * @example Usage
 * ```ts
 * import { resolve } from "@std/path/resolve";
 * import { assertEquals } from "@std/assert";
 *
 * if (Deno.build.os === "windows") {
 *   assertEquals(resolve("C:\\foo", "bar", "baz"), "C:\\foo\\bar\\baz");
 *   assertEquals(resolve("C:\\foo", "C:\\bar", "baz"), "C:\\bar\\baz");
 * } else {
 *   assertEquals(resolve("/foo", "bar", "baz"), "/foo/bar/baz");
 *   assertEquals(resolve("/foo", "/bar", "baz"), "/bar/baz");
 * }
 * ```
 *
 * @param pathSegments Path segments to process to path.
 * @returns The resolved path.
 */
function resolve(...pathSegments) {
    return _os_js_1.isWindows
        ? (0, resolve_js_2.resolve)(...pathSegments)
        : (0, resolve_js_1.resolve)(...pathSegments);
}
