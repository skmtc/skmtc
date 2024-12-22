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
var _OasRef_fields, _OasRef_oasDocument;
import { toRefName } from '../../helpers/refFns.js';
import { match } from 'ts-pattern';
const MAX_LOOKUPS = 10;
export class OasRef {
    constructor(fields, oasDocument) {
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ref'
        });
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ref'
        });
        _OasRef_fields.set(this, void 0);
        _OasRef_oasDocument.set(this, void 0);
        __classPrivateFieldSet(this, _OasRef_fields, fields, "f");
        __classPrivateFieldSet(this, _OasRef_oasDocument, oasDocument, "f");
    }
    isRef() {
        return true;
    }
    resolve(lookupsPerformed = 0) {
        if (lookupsPerformed >= MAX_LOOKUPS) {
            throw new Error('Max lookups reached');
        }
        const resolved = this.resolveOnce();
        return resolved.isRef() ? resolved.resolve(lookupsPerformed + 1) : resolved;
    }
    resolveOnce() {
        const c = this.oasDocument.components;
        const refName = toRefName(this.$ref);
        const refType = this.refType;
        const resolved = match(refType)
            .with('schema', () => c?.schemas?.[refName])
            .with('requestBody', () => c?.requestBodies?.[refName])
            .with('parameter', () => c?.parameters?.[refName])
            .with('response', () => c?.responses?.[refName])
            .with('example', () => c?.examples?.[refName])
            .with('header', () => c?.headers?.[refName])
            .exhaustive();
        if (!resolved) {
            throw new Error(`Ref "${__classPrivateFieldGet(this, _OasRef_fields, "f").$ref}" not found`);
        }
        if (resolved.isRef()) {
            if (resolved.refType !== this.refType) {
                throw new Error(`Ref type mismatch for "${this.$ref}". Expected "${this.refType}" but got "${resolved.refType}"`);
            }
        }
        else {
            if (resolved.oasType !== this.refType) {
                throw new Error(`Type mismatch for "${this.$ref}". Expected "${this.refType}" but got "${resolved.oasType}"`);
            }
        }
        return resolved;
    }
    toRefName() {
        return toRefName(__classPrivateFieldGet(this, _OasRef_fields, "f").$ref);
    }
    get $ref() {
        return __classPrivateFieldGet(this, _OasRef_fields, "f").$ref;
    }
    get refType() {
        return __classPrivateFieldGet(this, _OasRef_fields, "f").refType;
    }
    get summary() {
        return __classPrivateFieldGet(this, _OasRef_fields, "f").summary;
    }
    get description() {
        return __classPrivateFieldGet(this, _OasRef_fields, "f").description;
    }
    get oasDocument() {
        return __classPrivateFieldGet(this, _OasRef_oasDocument, "f");
    }
}
_OasRef_fields = new WeakMap(), _OasRef_oasDocument = new WeakMap();
