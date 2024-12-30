"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _ConsoleHandler_useColors;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleHandler = void 0;
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
const levels_js_1 = require("./levels.js");
const colors_js_1 = require("../../fmt/1.0.2/colors.js");
const base_handler_js_1 = require("./base_handler.js");
/**
 * This is the default logger. It will output color coded log messages to the
 * console via `console.log()`.
 */
class ConsoleHandler extends base_handler_js_1.BaseHandler {
    constructor(levelName, options = {}) {
        super(levelName, options);
        _ConsoleHandler_useColors.set(this, void 0);
        __classPrivateFieldSet(this, _ConsoleHandler_useColors, options.useColors ?? true, "f");
    }
    format(logRecord) {
        let msg = super.format(logRecord);
        if (__classPrivateFieldGet(this, _ConsoleHandler_useColors, "f")) {
            msg = this.applyColors(msg, logRecord.level);
        }
        return msg;
    }
    applyColors(msg, level) {
        switch (level) {
            case levels_js_1.LogLevels.INFO:
                msg = (0, colors_js_1.blue)(msg);
                break;
            case levels_js_1.LogLevels.WARN:
                msg = (0, colors_js_1.yellow)(msg);
                break;
            case levels_js_1.LogLevels.ERROR:
                msg = (0, colors_js_1.red)(msg);
                break;
            case levels_js_1.LogLevels.CRITICAL:
                msg = (0, colors_js_1.bold)((0, colors_js_1.red)(msg));
                break;
            default:
                break;
        }
        return msg;
    }
    log(msg) {
        // deno-lint-ignore no-console
        console.log(msg);
    }
}
exports.ConsoleHandler = ConsoleHandler;
_ConsoleHandler_useColors = new WeakMap();
