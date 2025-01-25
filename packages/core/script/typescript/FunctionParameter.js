"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionParameter = void 0;
const helper_validator_identifier_1 = require("@babel/helper-validator-identifier");
const lodash_es_1 = require("lodash-es");
const ts_pattern_1 = require("ts-pattern");
const List_js_1 = require("./List.js");
class FunctionParameter {
    constructor(args) {
        Object.defineProperty(this, "properties", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "skipEmpty", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.skipEmpty = args.skipEmpty;
        if (args.typeDefinition.value.type === 'object') {
            this.properties = (0, ts_pattern_1.match)(args)
                .with({ destructure: true, required: true }, ({ typeDefinition, required }) => ({
                type: 'destructured',
                typeDefinition: typeDefinition,
                required
            }))
                .with({ name: ts_pattern_1.P.string }, ({ typeDefinition, name, required }) => ({
                type: 'regular',
                name,
                typeDefinition: typeDefinition,
                required: required ?? false
            }))
                .otherwise(() => {
                throw new Error('Invalid FunctionParameter');
            });
        }
        else {
            this.properties = { type: 'void' };
        }
    }
    hasProperty(name) {
        return (0, ts_pattern_1.match)(this.properties)
            .with({ type: 'void' }, () => false)
            .with({ type: 'regular' }, ({ typeDefinition }) => {
            const { value } = typeDefinition;
            return Boolean(value.type === 'object' && value.objectProperties?.properties[name]);
        })
            .with({ type: 'destructured' }, ({ typeDefinition }) => {
            return Boolean(typeDefinition.value.objectProperties?.properties[name]);
        })
            .exhaustive();
    }
    toPropertyList() {
        return (0, ts_pattern_1.match)(this.properties)
            .with({ type: 'void' }, () => List_js_1.List.toEmpty())
            .with({ type: 'regular' }, ({ name }) => List_js_1.List.toSingle(name))
            .with({ type: 'destructured' }, ({ typeDefinition }) => {
            return List_js_1.List.fromKeys(typeDefinition.value.objectProperties?.properties).toObjectPlain();
        })
            .exhaustive();
    }
    toInbound() {
        return (0, ts_pattern_1.match)(this.properties)
            .with({ type: 'void' }, () => '')
            .with({ type: 'regular' }, ({ name }) => `${name}`)
            .with({ type: 'destructured' }, ({ typeDefinition }) => {
            return toDestructured(typeDefinition, { skipEmpty: this.skipEmpty }).toString();
        })
            .exhaustive();
    }
    toString() {
        return (0, ts_pattern_1.match)(this.properties)
            .with({ type: 'void' }, () => '')
            .with({ type: 'regular' }, ({ name, typeDefinition, required }) => {
            return `${name}${required ? '' : '?'}: ${typeDefinition.identifier}`;
        })
            .with({ type: 'destructured' }, ({ typeDefinition }) => {
            return List_js_1.List.toKeyValue(toDestructured(typeDefinition, { skipEmpty: this.skipEmpty }).toString(), typeDefinition.identifier).toString();
        })
            .exhaustive();
    }
}
exports.FunctionParameter = FunctionParameter;
const toDestructured = (typeDefinition, { skipEmpty } = {}) => {
    return List_js_1.List.fromKeys(typeDefinition.value.objectProperties?.properties).toObject(key => {
        return (0, helper_validator_identifier_1.isIdentifierName)(key) ? key : List_js_1.List.toKeyValue(key, (0, lodash_es_1.camelCase)(key));
    }, {
        skipEmpty
    });
};
