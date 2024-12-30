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
var _OasTag_fields;
export class OasTag {
    constructor(fields) {
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'tag'
        });
        _OasTag_fields.set(this, void 0);
        __classPrivateFieldSet(this, _OasTag_fields, fields, "f");
    }
    get name() {
        return __classPrivateFieldGet(this, _OasTag_fields, "f").name;
    }
    get description() {
        return __classPrivateFieldGet(this, _OasTag_fields, "f").description;
    }
    /** Specification Extension fields */
    get extensionFields() {
        return __classPrivateFieldGet(this, _OasTag_fields, "f").extensionFields;
    }
}
_OasTag_fields = new WeakMap();
