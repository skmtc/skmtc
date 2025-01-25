import type { TypeSystemObject, TypeSystemValue, TypeSystemVoid } from '../types/TypeSystem.js';
import type { Definition } from '../dsl/Definition.js';
import { List } from './List.js';
type FunctionParameterArgs = {
    name?: string;
    typeDefinition: Definition<TypeSystemObject | TypeSystemVoid>;
    destructure?: boolean;
    required?: boolean;
    skipEmpty?: boolean;
};
type ParameterProperties = VoidParameter | DestructuredParameter | RegularParameter;
type VoidParameter = {
    type: 'void';
};
type DestructuredParameter = {
    type: 'destructured';
    typeDefinition: Definition<TypeSystemObject>;
    required: true;
};
type RegularParameter = {
    type: 'regular';
    name: string;
    typeDefinition: Definition<TypeSystemValue>;
    required: boolean;
};
export declare class FunctionParameter {
    properties: ParameterProperties;
    skipEmpty?: boolean;
    constructor(args: FunctionParameterArgs);
    hasProperty(name: string): boolean;
    toPropertyList(): List;
    toInbound(): string;
    toString(): string;
}
export {};
//# sourceMappingURL=FunctionParameter.d.ts.map