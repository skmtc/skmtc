"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PathParams = void 0;
const Definition_js_1 = require("../dsl/Definition.js");
const Identifier_js_1 = require("../dsl/Identifier.js");
const FunctionParameter_js_1 = require("./FunctionParameter.js");
const toPathTemplate_js_1 = require("./toPathTemplate.js");
class PathParams {
    constructor({ context, argName, typeName, typeValue, pathTemplate }) {
        Object.defineProperty(this, "context", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "typeDefinition", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "parameter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "path", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.context = context;
        this.typeDefinition = new Definition_js_1.Definition({
            context,
            identifier: Identifier_js_1.Identifier.createType(typeName),
            value: typeValue
        });
        this.parameter = new FunctionParameter_js_1.FunctionParameter({
            name: argName,
            typeDefinition: this.typeDefinition,
            destructure: !argName,
            required: true
        });
        const queryArg = this.parameter.properties.type === 'regular'
            ? this.parameter.properties.name
            : undefined;
        // @TODO Reconcile pathTemplate with params
        this.path = (0, toPathTemplate_js_1.toPathTemplate)(pathTemplate, queryArg);
    }
}
exports.PathParams = PathParams;
