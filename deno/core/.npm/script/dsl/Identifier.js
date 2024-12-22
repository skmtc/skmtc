"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Identifier = void 0;
const EntityType_js_1 = require("./EntityType.js");
class Identifier {
    constructor({ name, typeName, entityType }) {
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "entityType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "typeName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = name;
        this.typeName = typeName;
        this.entityType = entityType;
    }
    static createVariable(name, typeName) {
        if (typeName) {
            return new Identifier({
                name,
                typeName,
                entityType: new EntityType_js_1.EntityType('variable')
            });
        }
        return new Identifier({
            name,
            entityType: new EntityType_js_1.EntityType('variable')
        });
    }
    static createType(name) {
        return new Identifier({
            name,
            entityType: new EntityType_js_1.EntityType('type')
        });
    }
    toString() {
        return this.name;
    }
}
exports.Identifier = Identifier;
