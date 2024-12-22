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
var _OasExample_fields;
/** Provides example data represented by schema */
export class OasExample {
    constructor(fields) {
        /** Static identifier property for OasExample */
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'example'
        });
        /** @internal */
        _OasExample_fields.set(this, void 0);
        __classPrivateFieldSet(this, _OasExample_fields, fields, "f");
    }
    /** Brief summary of example */
    get summary() {
        return __classPrivateFieldGet(this, _OasExample_fields, "f").summary;
    }
    /** Detailed description of the example. May contain CommonMark Markdown */
    get description() {
        return __classPrivateFieldGet(this, _OasExample_fields, "f").description;
    }
    /** Embedded example value */
    get value() {
        return __classPrivateFieldGet(this, _OasExample_fields, "f").value;
    }
    /** Specification Extension fields */
    get extensionFields() {
        return __classPrivateFieldGet(this, _OasExample_fields, "f").extensionFields;
    }
    /** Returns true if object is a reference */
    isRef() {
        return false;
    }
    /** Returns itself */
    resolve() {
        return this;
    }
    resolveOnce() {
        return this;
    }
}
_OasExample_fields = new WeakMap();
