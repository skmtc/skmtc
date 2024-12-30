import { Definition } from '../dsl/Definition.js';
import { Identifier } from '../dsl/Identifier.js';
import { FunctionParameter } from './FunctionParameter.js';
import { toPathTemplate } from './toPathTemplate.js';
export class PathParams {
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
        this.typeDefinition = new Definition({
            context,
            identifier: Identifier.createType(typeName),
            value: typeValue
        });
        this.parameter = new FunctionParameter({
            name: argName,
            typeDefinition: this.typeDefinition,
            destructure: !argName,
            required: true
        });
        const queryArg = this.parameter.properties.type === 'regular'
            ? this.parameter.properties.name
            : undefined;
        // @TODO Reconcile pathTemplate with params
        this.path = toPathTemplate(pathTemplate, queryArg);
    }
}
