"use strict";
// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Schema = void 0;
const _error_js_1 = require("./_error.js");
function compileList(schema, name, result) {
    const exclude = [];
    for (const includedSchema of schema.include) {
        result = compileList(includedSchema, name, result);
    }
    for (const currentType of schema[name]) {
        for (let previousIndex = 0; previousIndex < result.length; previousIndex++) {
            const previousType = result[previousIndex];
            if (previousType.tag === currentType.tag &&
                previousType.kind === currentType.kind) {
                exclude.push(previousIndex);
            }
        }
        result.push(currentType);
    }
    return result.filter((_type, index) => !exclude.includes(index));
}
function compileMap(...typesList) {
    const result = {
        fallback: {},
        mapping: {},
        scalar: {},
        sequence: {},
    };
    for (const types of typesList) {
        for (const type of types) {
            if (type.kind !== null) {
                result[type.kind][type.tag] = result["fallback"][type.tag] = type;
            }
        }
    }
    return result;
}
class Schema {
    constructor(definition) {
        Object.defineProperty(this, "implicit", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "explicit", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "include", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "compiledImplicit", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "compiledExplicit", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "compiledTypeMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.explicit = definition.explicit || [];
        this.implicit = definition.implicit || [];
        this.include = definition.include || [];
        for (const type of this.implicit) {
            if (type.loadKind && type.loadKind !== "scalar") {
                throw new _error_js_1.YAMLError("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
            }
        }
        this.compiledImplicit = compileList(this, "implicit", []);
        this.compiledExplicit = compileList(this, "explicit", []);
        this.compiledTypeMap = compileMap(this.compiledImplicit, this.compiledExplicit);
    }
    /* Returns a new extended schema from current schema */
    extend(definition) {
        return new Schema({
            implicit: [
                ...new Set([...this.implicit, ...(definition?.implicit ?? [])]),
            ],
            explicit: [
                ...new Set([...this.explicit, ...(definition?.explicit ?? [])]),
            ],
            include: [...new Set([...this.include, ...(definition?.include ?? [])])],
        });
    }
    static create() { }
}
exports.Schema = Schema;
