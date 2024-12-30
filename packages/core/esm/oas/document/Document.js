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
var _OasDocument_fields;
/** Top level document object describing the API */
export class OasDocument {
    constructor(fields) {
        /** Static identifier property for OasDocument */
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'openapi'
        });
        /** @internal */
        _OasDocument_fields.set(this, void 0);
        __classPrivateFieldSet(this, _OasDocument_fields, fields, "f");
    }
    set fields(fields) {
        __classPrivateFieldSet(this, _OasDocument_fields, fields, "f");
    }
    /** OpenAPI specification version */
    get openapi() {
        if (!__classPrivateFieldGet(this, _OasDocument_fields, "f")) {
            throw new Error(`Accessing 'openapi' before fields are set`);
        }
        return __classPrivateFieldGet(this, _OasDocument_fields, "f").openapi;
    }
    /** API metadata */
    get info() {
        if (!__classPrivateFieldGet(this, _OasDocument_fields, "f")) {
            throw new Error(`Accessing 'info' before fields are set`);
        }
        return __classPrivateFieldGet(this, _OasDocument_fields, "f").info;
    }
    /** List of all operations for the API */
    get operations() {
        if (!__classPrivateFieldGet(this, _OasDocument_fields, "f")) {
            throw new Error(`Accessing 'operations' before fields are set`);
        }
        return __classPrivateFieldGet(this, _OasDocument_fields, "f").operations;
    }
    /** Container object for re-usable schema items within the API */
    get components() {
        if (!__classPrivateFieldGet(this, _OasDocument_fields, "f")) {
            throw new Error(`Accessing 'components' before fields are set`);
        }
        return __classPrivateFieldGet(this, _OasDocument_fields, "f").components;
    }
    /** List of tags used by API with additional metadata */
    get tags() {
        if (!__classPrivateFieldGet(this, _OasDocument_fields, "f")) {
            throw new Error(`Accessing 'tags' before fields are set`);
        }
        return __classPrivateFieldGet(this, _OasDocument_fields, "f").tags;
    }
    /** Specification Extension fields */
    get extensionFields() {
        if (!__classPrivateFieldGet(this, _OasDocument_fields, "f")) {
            throw new Error(`Accessing 'extensionFields' before fields are set`);
        }
        return __classPrivateFieldGet(this, _OasDocument_fields, "f").extensionFields;
    }
}
_OasDocument_fields = new WeakMap();
