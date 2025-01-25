import { isIdentifierName } from '@babel/helper-validator-identifier';
import { camelCase } from 'lodash-es';
import { match, P } from 'ts-pattern';
import { List } from './List.js';
export class FunctionParameter {
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
            this.properties = match(args)
                .with({ destructure: true, required: true }, ({ typeDefinition, required }) => ({
                type: 'destructured',
                typeDefinition: typeDefinition,
                required
            }))
                .with({ name: P.string }, ({ typeDefinition, name, required }) => ({
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
        return match(this.properties)
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
        return match(this.properties)
            .with({ type: 'void' }, () => List.toEmpty())
            .with({ type: 'regular' }, ({ name }) => List.toSingle(name))
            .with({ type: 'destructured' }, ({ typeDefinition }) => {
            return List.fromKeys(typeDefinition.value.objectProperties?.properties).toObjectPlain();
        })
            .exhaustive();
    }
    toInbound() {
        return match(this.properties)
            .with({ type: 'void' }, () => '')
            .with({ type: 'regular' }, ({ name }) => `${name}`)
            .with({ type: 'destructured' }, ({ typeDefinition }) => {
            return toDestructured(typeDefinition).toString();
        })
            .exhaustive();
    }
    toString() {
        return match(this.properties)
            .with({ type: 'void' }, () => '')
            .with({ type: 'regular' }, ({ name, typeDefinition, required }) => {
            return `${name}${required ? '' : '?'}: ${typeDefinition.identifier}`;
        })
            .with({ type: 'destructured' }, ({ typeDefinition }) => {
            if (this.skipEmpty) {
                const isEmpty = Object.keys(typeDefinition.value.objectProperties?.properties ?? {}).length === 0;
                if (isEmpty) {
                    return '';
                }
            }
            return List.toKeyValue(toDestructured(typeDefinition).toString(), typeDefinition.identifier).toString();
        })
            .exhaustive();
    }
}
const toDestructured = (typeDefinition) => {
    return List.fromKeys(typeDefinition.value.objectProperties?.properties).toObject(key => {
        return isIdentifierName(key) ? key : List.toKeyValue(key, camelCase(key));
    });
};
