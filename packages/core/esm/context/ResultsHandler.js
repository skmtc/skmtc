var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _ResultsHandler_instances, _ResultsHandler_unloadCallback, _ResultsHandler_resetBuffer;
import { LogLevels } from '../deps/jsr.io/@std/log/0.224.8/levels.js';
import { BaseHandler } from '../deps/jsr.io/@std/log/0.224.8/base_handler.js';
import { match } from 'ts-pattern';
export class ResultsHandler extends BaseHandler {
    constructor(levelName, options) {
        super(levelName, options);
        _ResultsHandler_instances.add(this);
        Object.defineProperty(this, "context", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        _ResultsHandler_unloadCallback.set(this, (() => {
            this.destroy();
        }).bind(this));
        this.context = options.context;
    }
    setup() {
        __classPrivateFieldGet(this, _ResultsHandler_instances, "m", _ResultsHandler_resetBuffer).call(this);
        addEventListener('unload', __classPrivateFieldGet(this, _ResultsHandler_unloadCallback, "f"));
    }
    handle(logRecord) {
        super.handle(logRecord);
        // Immediately flush if log level is higher than ERROR
        if (logRecord.level > LogLevels.ERROR) {
            this.flush();
        }
    }
    log(levelName) {
        this.context.captureCurrentResult(match(levelName)
            .with('WARN', () => 'warning')
            .with('ERROR', () => 'error')
            .otherwise(() => {
            throw new Error(`Unexpected log level name: ${levelName}`);
        }));
    }
    flush() {
        __classPrivateFieldGet(this, _ResultsHandler_instances, "m", _ResultsHandler_resetBuffer).call(this);
    }
    destroy() {
        this.flush();
        removeEventListener('unload', __classPrivateFieldGet(this, _ResultsHandler_unloadCallback, "f"));
    }
}
_ResultsHandler_unloadCallback = new WeakMap(), _ResultsHandler_instances = new WeakSet(), _ResultsHandler_resetBuffer = function _ResultsHandler_resetBuffer() { };
