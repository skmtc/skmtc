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
var _OasHeader_fields;
/** Describes a single header in the API */
export class OasHeader {
    constructor(fields) {
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'header'
        });
        _OasHeader_fields.set(this, void 0);
        __classPrivateFieldSet(this, _OasHeader_fields, fields, "f");
    }
    /** Brief description of header */
    get description() {
        return __classPrivateFieldGet(this, _OasHeader_fields, "f").description;
    }
    /** Indicates if header is mandatory. Default value is `false` */
    get required() {
        return __classPrivateFieldGet(this, _OasHeader_fields, "f").required;
    }
    /** Indicates if header is deprecated and should no longer be used. Default value is false */
    get deprecated() {
        return __classPrivateFieldGet(this, _OasHeader_fields, "f").deprecated;
    }
    /** Schema for the header */
    get schema() {
        return __classPrivateFieldGet(this, _OasHeader_fields, "f").schema;
    }
    /** Examples of the header */
    get examples() {
        return __classPrivateFieldGet(this, _OasHeader_fields, "f").examples;
    }
    /** Content of the header */
    get content() {
        return __classPrivateFieldGet(this, _OasHeader_fields, "f").content;
    }
    /** Specification Extension fields */
    get extensionFields() {
        return __classPrivateFieldGet(this, _OasHeader_fields, "f").extensionFields;
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
    /** Returns schema for the header. Either, `schema` property if
     * definedor value matching `mediaType` from `content` property.
     *
     * @param mediaType - Optional media type to get schema for. Defaults to `application/json`
     */
    toSchema(mediaType = 'application/json') {
        if (this.schema) {
            return this.schema;
        }
        const schema = __classPrivateFieldGet(this, _OasHeader_fields, "f").content?.[mediaType]?.schema;
        if (!schema) {
            throw new Error(`Schema not found for media type ${mediaType}`);
        }
        return schema;
    }
}
_OasHeader_fields = new WeakMap();
