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
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _FileHandler_instances, _FileHandler_unloadCallback, _FileHandler_resetBuffer, _a, _b, _c, _d, _e, _f, _g;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileHandler = void 0;
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
const dntShim = __importStar(require("../../../../../_dnt.shims.js"));
const levels_js_1 = require("./levels.js");
const base_handler_js_1 = require("./base_handler.js");
const write_all_js_1 = require("../../io/0.224.9/write_all.js");
const _file_handler_symbols_js_1 = require("./_file_handler_symbols.js");
/**
 * This handler will output to a file using an optional mode (default is `a`,
 * e.g. append). The file will grow indefinitely. It uses a buffer for writing
 * to file. Logs can be manually flushed with `fileHandler.flush()`. Log
 * messages with a log level greater than error are immediately flushed. Logs
 * are also flushed on process completion.
 *
 * Behavior of the log modes is as follows:
 *
 * - `'a'` - Default mode. Appends new log messages to the end of an existing log
 *   file, or create a new log file if none exists.
 * - `'w'` - Upon creation of the handler, any existing log file will be removed
 *   and a new one created.
 * - `'x'` - This will create a new log file and throw an error if one already
 *   exists.
 *
 * This handler requires `--allow-write` permission on the log file.
 */
class FileHandler extends base_handler_js_1.BaseHandler {
    constructor(levelName, options) {
        super(levelName, options);
        _FileHandler_instances.add(this);
        Object.defineProperty(this, _a, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, _b, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, _c, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, _d, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, _e, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, _f, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, _g, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new TextEncoder()
        });
        _FileHandler_unloadCallback.set(this, (() => {
            this.destroy();
        }).bind(this));
        this[_file_handler_symbols_js_1.filenameSymbol] = options.filename;
        // default to append mode, write only
        this[_file_handler_symbols_js_1.modeSymbol] = options.mode ?? "a";
        this[_file_handler_symbols_js_1.openOptionsSymbol] = {
            createNew: this[_file_handler_symbols_js_1.modeSymbol] === "x",
            create: this[_file_handler_symbols_js_1.modeSymbol] !== "x",
            append: this[_file_handler_symbols_js_1.modeSymbol] === "a",
            truncate: this[_file_handler_symbols_js_1.modeSymbol] !== "a",
            write: true,
        };
        this[_file_handler_symbols_js_1.bufSymbol] = new Uint8Array(options.bufferSize ?? 4096);
    }
    setup() {
        this[_file_handler_symbols_js_1.fileSymbol] = dntShim.Deno.openSync(this[_file_handler_symbols_js_1.filenameSymbol], this[_file_handler_symbols_js_1.openOptionsSymbol]);
        __classPrivateFieldGet(this, _FileHandler_instances, "m", _FileHandler_resetBuffer).call(this);
        addEventListener("unload", __classPrivateFieldGet(this, _FileHandler_unloadCallback, "f"));
    }
    handle(logRecord) {
        super.handle(logRecord);
        // Immediately flush if log level is higher than ERROR
        if (logRecord.level > levels_js_1.LogLevels.ERROR) {
            this.flush();
        }
    }
    log(msg) {
        const bytes = this[_file_handler_symbols_js_1.encoderSymbol].encode(msg + "\n");
        if (bytes.byteLength > this[_file_handler_symbols_js_1.bufSymbol].byteLength - this[_file_handler_symbols_js_1.pointerSymbol]) {
            this.flush();
        }
        if (bytes.byteLength > this[_file_handler_symbols_js_1.bufSymbol].byteLength) {
            (0, write_all_js_1.writeAllSync)(this[_file_handler_symbols_js_1.fileSymbol], bytes);
        }
        else {
            this[_file_handler_symbols_js_1.bufSymbol].set(bytes, this[_file_handler_symbols_js_1.pointerSymbol]);
            this[_file_handler_symbols_js_1.pointerSymbol] += bytes.byteLength;
        }
    }
    flush() {
        if (this[_file_handler_symbols_js_1.pointerSymbol] > 0 && this[_file_handler_symbols_js_1.fileSymbol]) {
            let written = 0;
            while (written < this[_file_handler_symbols_js_1.pointerSymbol]) {
                written += this[_file_handler_symbols_js_1.fileSymbol].writeSync(this[_file_handler_symbols_js_1.bufSymbol].subarray(written, this[_file_handler_symbols_js_1.pointerSymbol]));
            }
            __classPrivateFieldGet(this, _FileHandler_instances, "m", _FileHandler_resetBuffer).call(this);
        }
    }
    destroy() {
        this.flush();
        this[_file_handler_symbols_js_1.fileSymbol]?.close();
        this[_file_handler_symbols_js_1.fileSymbol] = undefined;
        removeEventListener("unload", __classPrivateFieldGet(this, _FileHandler_unloadCallback, "f"));
    }
}
exports.FileHandler = FileHandler;
_FileHandler_unloadCallback = new WeakMap(), _FileHandler_instances = new WeakSet(), _a = _file_handler_symbols_js_1.fileSymbol, _b = _file_handler_symbols_js_1.bufSymbol, _c = _file_handler_symbols_js_1.pointerSymbol, _d = _file_handler_symbols_js_1.filenameSymbol, _e = _file_handler_symbols_js_1.modeSymbol, _f = _file_handler_symbols_js_1.openOptionsSymbol, _g = _file_handler_symbols_js_1.encoderSymbol, _FileHandler_resetBuffer = function _FileHandler_resetBuffer() {
    this[_file_handler_symbols_js_1.pointerSymbol] = 0;
};
