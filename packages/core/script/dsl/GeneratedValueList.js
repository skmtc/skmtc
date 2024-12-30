"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneratedValueList = void 0;
const constants_js_1 = require("./constants.js");
class GeneratedValueList {
    constructor(separator) {
        Object.defineProperty(this, "separator", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "items", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        this.separator = separator;
    }
    add(str) {
        this.items.push(str);
    }
    toString() {
        return this.items
            .map(item => item.toString())
            .filter(item => item !== constants_js_1.EMPTY)
            .join(this.separator);
    }
}
exports.GeneratedValueList = GeneratedValueList;
