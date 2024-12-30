"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OasDiscriminator = void 0;
class OasDiscriminator {
    constructor(fields) {
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'discriminator'
        });
        Object.defineProperty(this, "propertyName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.propertyName = fields.propertyName;
    }
}
exports.OasDiscriminator = OasDiscriminator;
