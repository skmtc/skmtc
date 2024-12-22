"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolve = resolve;
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
const dntShim = __importStar(require("../../../../../../_dnt.shims.js"));
const normalize_string_js_1 = require("../_common/normalize_string.js");
const assert_path_js_1 = require("../_common/assert_path.js");
const _util_js_1 = require("./_util.js");
/**
 * Resolves path segments into a `path`.
 *
 * @example Usage
 * ```ts
 * import { resolve } from "@std/path/posix/resolve";
 * import { assertEquals } from "@std/assert";
 *
 * const path = resolve("/foo", "bar", "baz/asdf", "quux", "..");
 * assertEquals(path, "/foo/bar/baz/asdf");
 * ```
 *
 * @param pathSegments The path segments to resolve.
 * @returns The resolved path.
 */
function resolve(...pathSegments) {
    let resolvedPath = "";
    let resolvedAbsolute = false;
    for (let i = pathSegments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
        let path;
        if (i >= 0)
            path = pathSegments[i];
        else {
            // deno-lint-ignore no-explicit-any
            const { Deno } = dntShim.dntGlobalThis;
            if (typeof Deno?.cwd !== "function") {
                throw new TypeError("Resolved a relative path without a current working directory (CWD)");
            }
            path = Deno.cwd();
        }
        (0, assert_path_js_1.assertPath)(path);
        // Skip empty entries
        if (path.length === 0) {
            continue;
        }
        resolvedPath = `${path}/${resolvedPath}`;
        resolvedAbsolute = (0, _util_js_1.isPosixPathSeparator)(path.charCodeAt(0));
    }
    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when Deno.cwd() fails)
    // Normalize the path
    resolvedPath = (0, normalize_string_js_1.normalizeString)(resolvedPath, !resolvedAbsolute, "/", _util_js_1.isPosixPathSeparator);
    if (resolvedAbsolute) {
        if (resolvedPath.length > 0)
            return `/${resolvedPath}`;
        else
            return "/";
    }
    else if (resolvedPath.length > 0)
        return resolvedPath;
    else
        return ".";
}
