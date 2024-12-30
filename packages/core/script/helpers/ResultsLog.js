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
var _ResultsLog_instances, _ResultsLog_results, _ResultsLog_incomingResultIsWorse;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultsLog = void 0;
const lodash_es_1 = require("lodash-es");
class ResultsLog {
    constructor() {
        _ResultsLog_instances.add(this);
        _ResultsLog_results.set(this, void 0);
        __classPrivateFieldSet(this, _ResultsLog_results, {}, "f");
    }
    capture(stackTrail, result) {
        if (__classPrivateFieldGet(this, _ResultsLog_instances, "m", _ResultsLog_incomingResultIsWorse).call(this, __classPrivateFieldGet(this, _ResultsLog_results, "f")[stackTrail], result)) {
            __classPrivateFieldGet(this, _ResultsLog_results, "f")[stackTrail] = result;
        }
    }
    toTree() {
        const tree = {};
        Object.entries(__classPrivateFieldGet(this, _ResultsLog_results, "f")).forEach(([key, value]) => {
            const keys = key.split(':');
            (0, lodash_es_1.set)(tree, keys, value);
        });
        return tree;
    }
}
exports.ResultsLog = ResultsLog;
_ResultsLog_results = new WeakMap(), _ResultsLog_instances = new WeakSet(), _ResultsLog_incomingResultIsWorse = function _ResultsLog_incomingResultIsWorse(current, incoming) {
    if (current === undefined) {
        return true;
    }
    return resultRankings[current] < resultRankings[incoming];
};
const resultRankings = {
    error: 50,
    warning: 40,
    success: 30,
    notSelected: 20,
    notSupported: 10
};
