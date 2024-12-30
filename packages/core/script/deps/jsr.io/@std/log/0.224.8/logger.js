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
var _LogRecord_args, _LogRecord_datetime, _Logger_instances, _Logger_level, _Logger_loggerName, _Logger_log;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogRecord = exports.LoggerConfig = void 0;
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
const levels_js_1 = require("./levels.js");
class LoggerConfig {
    constructor() {
        Object.defineProperty(this, "level", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "handlers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
    }
}
exports.LoggerConfig = LoggerConfig;
/**
 * An object that encapsulates provided message and arguments as well some
 * metadata that can be later used when formatting a message.
 */
class LogRecord {
    constructor(options) {
        Object.defineProperty(this, "msg", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        _LogRecord_args.set(this, void 0);
        _LogRecord_datetime.set(this, void 0);
        Object.defineProperty(this, "level", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "levelName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "loggerName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.msg = options.msg;
        __classPrivateFieldSet(this, _LogRecord_args, [...options.args], "f");
        this.level = options.level;
        this.loggerName = options.loggerName;
        __classPrivateFieldSet(this, _LogRecord_datetime, new Date(), "f");
        this.levelName = (0, levels_js_1.getLevelName)(options.level);
    }
    get args() {
        return [...__classPrivateFieldGet(this, _LogRecord_args, "f")];
    }
    get datetime() {
        return new Date(__classPrivateFieldGet(this, _LogRecord_datetime, "f").getTime());
    }
}
exports.LogRecord = LogRecord;
_LogRecord_args = new WeakMap(), _LogRecord_datetime = new WeakMap();
class Logger {
    constructor(loggerName, levelName, options = {}) {
        _Logger_instances.add(this);
        _Logger_level.set(this, void 0);
        Object.defineProperty(this, "handlers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        _Logger_loggerName.set(this, void 0);
        __classPrivateFieldSet(this, _Logger_loggerName, loggerName, "f");
        __classPrivateFieldSet(this, _Logger_level, (0, levels_js_1.getLevelByName)(levelName), "f");
        this.handlers = options.handlers ?? [];
    }
    /** Use this to retrieve the current numeric log level. */
    get level() {
        return __classPrivateFieldGet(this, _Logger_level, "f");
    }
    /** Use this to set the numeric log level. */
    set level(level) {
        try {
            __classPrivateFieldSet(this, _Logger_level, (0, levels_js_1.getLevelByName)((0, levels_js_1.getLevelName)(level)), "f");
        }
        catch (_) {
            throw new TypeError(`Invalid log level: ${level}`);
        }
    }
    get levelName() {
        return (0, levels_js_1.getLevelName)(__classPrivateFieldGet(this, _Logger_level, "f"));
    }
    set levelName(levelName) {
        __classPrivateFieldSet(this, _Logger_level, (0, levels_js_1.getLevelByName)(levelName), "f");
    }
    get loggerName() {
        return __classPrivateFieldGet(this, _Logger_loggerName, "f");
    }
    asString(data, isProperty = false) {
        if (typeof data === "string") {
            if (isProperty)
                return `"${data}"`;
            return data;
        }
        else if (data === null ||
            typeof data === "number" ||
            typeof data === "bigint" ||
            typeof data === "boolean" ||
            typeof data === "undefined" ||
            typeof data === "symbol") {
            return String(data);
        }
        else if (data instanceof Error) {
            return data.stack;
        }
        else if (typeof data === "object") {
            return `{${Object.entries(data)
                .map(([k, v]) => `"${k}":${this.asString(v, true)}`)
                .join(",")}}`;
        }
        return "undefined";
    }
    debug(msg, ...args) {
        return __classPrivateFieldGet(this, _Logger_instances, "m", _Logger_log).call(this, levels_js_1.LogLevels.DEBUG, msg, ...args);
    }
    info(msg, ...args) {
        return __classPrivateFieldGet(this, _Logger_instances, "m", _Logger_log).call(this, levels_js_1.LogLevels.INFO, msg, ...args);
    }
    warn(msg, ...args) {
        return __classPrivateFieldGet(this, _Logger_instances, "m", _Logger_log).call(this, levels_js_1.LogLevels.WARN, msg, ...args);
    }
    error(msg, ...args) {
        return __classPrivateFieldGet(this, _Logger_instances, "m", _Logger_log).call(this, levels_js_1.LogLevels.ERROR, msg, ...args);
    }
    critical(msg, ...args) {
        return __classPrivateFieldGet(this, _Logger_instances, "m", _Logger_log).call(this, levels_js_1.LogLevels.CRITICAL, msg, ...args);
    }
}
exports.Logger = Logger;
_Logger_level = new WeakMap(), _Logger_loggerName = new WeakMap(), _Logger_instances = new WeakSet(), _Logger_log = function _Logger_log(level, msg, ...args) {
    if (this.level > level) {
        return msg instanceof Function ? undefined : msg;
    }
    let fnResult;
    let logMessage;
    if (msg instanceof Function) {
        fnResult = msg();
        logMessage = this.asString(fnResult);
    }
    else {
        logMessage = this.asString(msg);
    }
    const record = new LogRecord({
        msg: logMessage,
        args: args,
        level: level,
        loggerName: this.loggerName,
    });
    this.handlers.forEach((handler) => {
        handler.handle(record);
    });
    return msg instanceof Function ? fnResult : msg;
};
