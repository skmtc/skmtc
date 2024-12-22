"use strict";
// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mark = void 0;
const _utils_js_1 = require("./_utils.js");
class Mark {
    constructor(name, buffer, position, line, column) {
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: name
        });
        Object.defineProperty(this, "buffer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: buffer
        });
        Object.defineProperty(this, "position", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: position
        });
        Object.defineProperty(this, "line", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: line
        });
        Object.defineProperty(this, "column", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: column
        });
    }
    getSnippet(indent = 4, maxLength = 75) {
        if (!this.buffer)
            return null;
        let head = "";
        let start = this.position;
        while (start > 0 &&
            "\x00\r\n\x85\u2028\u2029".indexOf(this.buffer.charAt(start - 1)) === -1) {
            start -= 1;
            if (this.position - start > maxLength / 2 - 1) {
                head = " ... ";
                start += 5;
                break;
            }
        }
        let tail = "";
        let end = this.position;
        while (end < this.buffer.length &&
            "\x00\r\n\x85\u2028\u2029".indexOf(this.buffer.charAt(end)) === -1) {
            end += 1;
            if (end - this.position > maxLength / 2 - 1) {
                tail = " ... ";
                end -= 5;
                break;
            }
        }
        const snippet = this.buffer.slice(start, end);
        return `${(0, _utils_js_1.repeat)(" ", indent)}${head}${snippet}${tail}\n${(0, _utils_js_1.repeat)(" ", indent + this.position - start + head.length)}^`;
    }
    toString(compact) {
        let snippet, where = "";
        if (this.name) {
            where += `in "${this.name}" `;
        }
        where += `at line ${this.line + 1}, column ${this.column + 1}`;
        if (!compact) {
            snippet = this.getSnippet();
            if (snippet) {
                where += `:\n${snippet}`;
            }
        }
        return where;
    }
}
exports.Mark = Mark;
