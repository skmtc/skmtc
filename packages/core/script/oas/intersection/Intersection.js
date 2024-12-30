"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OasIntersection = void 0;
class OasIntersection {
    constructor(fields) {
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'schema'
        });
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'intersection'
        });
        Object.defineProperty(this, "title", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "description", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "nullable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "discriminator", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "members", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "extensionFields", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "example", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.title = fields.title;
        this.description = fields.description;
        this.nullable = fields.nullable;
        this.discriminator = fields.discriminator;
        this.members = fields.members;
        this.extensionFields = fields.extensionFields;
        this.example = fields.example;
    }
    isRef() {
        return false;
    }
    resolve() {
        return this;
    }
    resolveOnce() {
        return this;
    }
    toJsonSchema(options) {
        return {
            allOf: this.members.map(member => member.toJsonSchema(options)),
            title: this.title,
            description: this.description,
            nullable: this.nullable,
            example: this.example
        };
    }
}
exports.OasIntersection = OasIntersection;
