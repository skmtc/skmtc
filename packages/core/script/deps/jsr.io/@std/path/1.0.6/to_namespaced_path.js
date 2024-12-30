"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.toNamespacedPath = toNamespacedPath;
const _os_js_1 = require("./_os.js");
const to_namespaced_path_js_1 = require("./posix/to_namespaced_path.js");
const to_namespaced_path_js_2 = require("./windows/to_namespaced_path.js");
/**
 * Resolves path to a namespace path.  This is a no-op on
 * non-windows systems.
 *
 * @example Usage
 * ```ts
 * import { toNamespacedPath } from "@std/path/to-namespaced-path";
 * import { assertEquals } from "@std/assert";
 *
 * if (Deno.build.os === "windows") {
 *   assertEquals(toNamespacedPath("C:\\foo\\bar"), "\\\\?\\C:\\foo\\bar");
 * } else {
 *   assertEquals(toNamespacedPath("/foo/bar"), "/foo/bar");
 * }
 * ```
 *
 * @param path Path to resolve to namespace.
 * @returns The resolved namespace path.
 */
function toNamespacedPath(path) {
    return _os_js_1.isWindows
        ? (0, to_namespaced_path_js_2.toNamespacedPath)(path)
        : (0, to_namespaced_path_js_1.toNamespacedPath)(path);
}
