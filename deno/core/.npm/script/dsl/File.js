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
var _File_generatorKeys;
Object.defineProperty(exports, "__esModule", { value: true });
exports.normaliseModuleName = exports.File = void 0;
const Import_js_1 = require("./Import.js");
class File {
    constructor({ path, settings }) {
        Object.defineProperty(this, "path", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "reExports", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "imports", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "definitions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        _File_generatorKeys.set(this, void 0);
        Object.defineProperty(this, "packages", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.path = path;
        this.reExports = new Map();
        this.imports = new Map();
        this.definitions = new Map();
        __classPrivateFieldSet(this, _File_generatorKeys, new Set(), "f");
        this.packages = settings?.packages;
    }
    get generatorKeys() {
        return __classPrivateFieldGet(this, _File_generatorKeys, "f");
    }
    toString() {
        const reExports = Array.from(this.reExports.entries()).flatMap(([module, entityTypes]) => {
            const updatedModuleName = (0, exports.normaliseModuleName)({
                destinationPath: this.path,
                exportPath: module,
                packages: this.packages
            });
            return Object.entries(entityTypes).map(([entityType, names]) => {
                const prefix = entityType === 'type' ? 'type' : '';
                return `export ${prefix} { ${Array.from(names).join(', ')} } from '${updatedModuleName}'`;
            });
        });
        const imports = Array.from(this.imports.entries()).map(([module, importItems]) => {
            const updatedModuleName = this.packages
                ? (0, exports.normaliseModuleName)({
                    destinationPath: this.path,
                    exportPath: module,
                    packages: this.packages
                })
                : module;
            return new Import_js_1.Import({ module: updatedModuleName, importNames: Array.from(importItems) });
        });
        const definitions = Array.from(this.definitions.values());
        return [reExports, imports, definitions]
            .filter(section => Boolean(section.length))
            .map(section => section.join('\n'))
            .join('\n\n');
    }
}
exports.File = File;
_File_generatorKeys = new WeakMap();
const normaliseModuleName = ({ destinationPath, exportPath, packages = [] }) => {
    const matchingModule = packages.find(packageModule => {
        return exportPath.startsWith(packageModule.rootPath);
    });
    if (!matchingModule) {
        return exportPath;
    }
    const { rootPath, moduleName } = matchingModule;
    return destinationPath.startsWith(rootPath) ? exportPath.replace(rootPath, '@') : moduleName;
};
exports.normaliseModuleName = normaliseModuleName;
