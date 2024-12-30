"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinGlobs = joinGlobs;
const _os_js_1 = require("./_os.js");
const join_globs_js_1 = require("./posix/join_globs.js");
const join_globs_js_2 = require("./windows/join_globs.js");
/**
 * Joins a sequence of globs, then normalizes the resulting glob.
 *
 * Behaves like {@linkcode https://jsr.io/@std/path/doc/~/join | join()}, but
 * doesn't collapse `**\/..` when `globstar` is true.
 *
 * @example Usage
 * ```ts
 * import { joinGlobs } from "@std/path/join-globs";
 * import { assertEquals } from "@std/assert";
 *
 * if (Deno.build.os === "windows") {
 *   assertEquals(joinGlobs(["foo", "bar", "..", "baz"]), "foo\\baz");
 *   assertEquals(joinGlobs(["foo", "**", "bar", "..", "baz"], { globstar: true }), "foo\\**\\baz");
 * } else {
 *   assertEquals(joinGlobs(["foo", "bar", "..", "baz"]), "foo/baz");
 *   assertEquals(joinGlobs(["foo", "**", "bar", "..", "baz"], { globstar: true }), "foo/**\/baz");
 * }
 * ```
 *
 * @param globs Globs to be joined and normalized.
 * @param options Glob options.
 * @returns The joined and normalized glob string.
 */
function joinGlobs(globs, options = {}) {
    return _os_js_1.isWindows
        ? (0, join_globs_js_2.joinGlobs)(globs, options)
        : (0, join_globs_js_1.joinGlobs)(globs, options);
}
