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
var _OasComponents_fields;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OasComponents = void 0;
/** Container object for re-usable schema items within the API
 *
 * Fields not yet implemented: **securitySchemes**, **links**, **callbacks**
 */
class OasComponents {
    constructor(fields) {
        /** Static identifier property for OasComponents */
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'components'
        });
        /** @internal */
        _OasComponents_fields.set(this, void 0);
        __classPrivateFieldSet(this, _OasComponents_fields, fields, "f");
    }
    toSchemasRefNames() {
        return Object.keys(__classPrivateFieldGet(this, _OasComponents_fields, "f").schemas ?? {});
    }
    /** Record holding re-usable {@link OasSchema} objects or Refs  */
    get schemas() {
        return __classPrivateFieldGet(this, _OasComponents_fields, "f").schemas;
    }
    /** Record holding re-usable {@link OasResponse} objects or Refs  */
    get responses() {
        return __classPrivateFieldGet(this, _OasComponents_fields, "f").responses;
    }
    /** Record holding re-usable {@link OasParameter} objects or Refs  */
    get parameters() {
        return __classPrivateFieldGet(this, _OasComponents_fields, "f").parameters;
    }
    /** Record holding re-usable {@link OasExample} objects or Refs  */
    get examples() {
        return __classPrivateFieldGet(this, _OasComponents_fields, "f").examples;
    }
    /** Record holding re-usable {@link OasRequestBody} objects or Refs  */
    get requestBodies() {
        return __classPrivateFieldGet(this, _OasComponents_fields, "f").requestBodies;
    }
    /** Record holding re-usable {@link OasHeader} objects or Refs  */
    get headers() {
        return __classPrivateFieldGet(this, _OasComponents_fields, "f").headers;
    }
    /** Specification Extension fields */
    get extensionFields() {
        return __classPrivateFieldGet(this, _OasComponents_fields, "f").extensionFields;
    }
}
exports.OasComponents = OasComponents;
_OasComponents_fields = new WeakMap();
