// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { State } from "../_state.js";
const { hasOwn } = Object;
function compileStyleMap(schema, map) {
    if (typeof map === "undefined" || map === null)
        return {};
    let type;
    const result = {};
    const keys = Object.keys(map);
    let tag, style;
    for (let index = 0, length = keys.length; index < length; index += 1) {
        tag = keys[index];
        style = String(map[tag]);
        if (tag.slice(0, 2) === "!!") {
            tag = `tag:yaml.org,2002:${tag.slice(2)}`;
        }
        type = schema.compiledTypeMap.fallback[tag];
        if (type &&
            typeof type.styleAliases !== "undefined" &&
            hasOwn(type.styleAliases, style)) {
            style = type.styleAliases[style];
        }
        result[tag] = style;
    }
    return result;
}
export class DumperState extends State {
    constructor({ schema, indent = 2, noArrayIndent = false, skipInvalid = false, flowLevel = -1, styles = null, sortKeys = false, lineWidth = 80, noRefs = false, noCompatMode = false, condenseFlow = false, }) {
        super(schema);
        Object.defineProperty(this, "indent", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "noArrayIndent", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "skipInvalid", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "flowLevel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "sortKeys", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lineWidth", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "noRefs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "noCompatMode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "condenseFlow", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "implicitTypes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "explicitTypes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "tag", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "result", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ""
        });
        Object.defineProperty(this, "duplicates", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "usedDuplicates", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        }); // changed from null to []
        Object.defineProperty(this, "styleMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "dump", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.indent = Math.max(1, indent);
        this.noArrayIndent = noArrayIndent;
        this.skipInvalid = skipInvalid;
        this.flowLevel = flowLevel;
        this.styleMap = compileStyleMap(this.schema, styles);
        this.sortKeys = sortKeys;
        this.lineWidth = lineWidth;
        this.noRefs = noRefs;
        this.noCompatMode = noCompatMode;
        this.condenseFlow = condenseFlow;
        this.implicitTypes = this.schema.compiledImplicit;
        this.explicitTypes = this.schema.compiledExplicit;
    }
}
