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
var _StackTrail_stack;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StackTrail = void 0;
class StackTrail {
    constructor(stack = []) {
        _StackTrail_stack.set(this, void 0);
        __classPrivateFieldSet(this, _StackTrail_stack, stack, "f");
    }
    clone() {
        return new StackTrail([...__classPrivateFieldGet(this, _StackTrail_stack, "f")]);
    }
    slice(start, end) {
        return new StackTrail(__classPrivateFieldGet(this, _StackTrail_stack, "f").slice(start, end));
    }
    get stackTrail() {
        return __classPrivateFieldGet(this, _StackTrail_stack, "f");
    }
    append(frame) {
        if (typeof frame === 'string') {
            __classPrivateFieldGet(this, _StackTrail_stack, "f").push(frame);
            return this;
        }
        if (Array.isArray(frame)) {
            frame.forEach(p => this.append(p));
            return this;
        }
        throw new Error(`Unexpected stack frame: ${frame}`);
    }
    getParentOf(frame) {
        const lastItemIndex = this.stackTrail.length - 1;
        if (this.stackTrail?.[lastItemIndex] === frame &&
            this.stackTrail?.[lastItemIndex - 1] === 'properties') {
            const parentName = this.stackTrail?.[lastItemIndex - 2];
            return typeof parentName === 'string' ? parentName : undefined;
        }
    }
    remove(frame) {
        if (typeof frame === 'string') {
            const lastItem = __classPrivateFieldGet(this, _StackTrail_stack, "f")[__classPrivateFieldGet(this, _StackTrail_stack, "f").length - 1];
            if (lastItem !== frame) {
                throw new Error(`Expected to remove frame '${frame}' but found '${lastItem}'`);
            }
            __classPrivateFieldGet(this, _StackTrail_stack, "f").pop();
            return this;
        }
        if (Array.isArray(frame)) {
            frame.toReversed().forEach(p => this.remove(p));
            return this;
        }
        throw new Error(`Unexpected stack frame: ${frame}`);
    }
    static join(...stacks) {
        return stacks.map(stack => stack.toString()).join(':');
    }
    static parse(value) {
        const stack = value.split(':').map(item => {
            if (!item) {
                throw new Error(`Empty stack trail token in: ${value}`);
            }
            return item.replaceAll('%3A', ':');
        });
        return new StackTrail(stack);
    }
    toString() {
        return __classPrivateFieldGet(this, _StackTrail_stack, "f")
            .map(item => {
            return typeof item === 'string' ? item.replaceAll(':', '%3A') : item;
        })
            .join(':');
    }
}
exports.StackTrail = StackTrail;
_StackTrail_stack = new WeakMap();
