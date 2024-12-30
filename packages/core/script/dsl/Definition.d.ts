import type { GenerateContext } from '../context/GenerateContext.js';
import type { Identifier } from './Identifier.js';
import { ValueBase } from './ValueBase.js';
import type { GeneratedValue } from '../types/GeneratedValue.js';
type ConstructorArgs<V extends GeneratedValue> = {
    context: GenerateContext;
    description?: string;
    identifier: Identifier;
    value: V;
};
export declare class Definition<V extends GeneratedValue = GeneratedValue> extends ValueBase {
    identifier: Identifier;
    description: string | undefined;
    value: V;
    constructor({ context, identifier, value, description }: ConstructorArgs<V>);
    toString(): string;
}
export {};
//# sourceMappingURL=Definition.d.ts.map