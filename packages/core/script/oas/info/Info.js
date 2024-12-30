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
var _OasInfo_fields;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OasInfo = void 0;
class OasInfo {
    constructor(fields) {
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'info'
        });
        _OasInfo_fields.set(this, void 0);
        __classPrivateFieldSet(this, _OasInfo_fields, fields, "f");
    }
    get title() {
        return __classPrivateFieldGet(this, _OasInfo_fields, "f").title;
    }
    get description() {
        return __classPrivateFieldGet(this, _OasInfo_fields, "f").description;
    }
    get termsOfService() {
        return __classPrivateFieldGet(this, _OasInfo_fields, "f").termsOfService;
    }
    get contact() {
        return __classPrivateFieldGet(this, _OasInfo_fields, "f").contact;
    }
    get license() {
        return __classPrivateFieldGet(this, _OasInfo_fields, "f").license;
    }
    get version() {
        return __classPrivateFieldGet(this, _OasInfo_fields, "f").version;
    }
    /** Specification Extension fields */
    get extensionFields() {
        return __classPrivateFieldGet(this, _OasInfo_fields, "f").extensionFields;
    }
}
exports.OasInfo = OasInfo;
_OasInfo_fields = new WeakMap();
