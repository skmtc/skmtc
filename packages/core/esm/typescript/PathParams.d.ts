import type { GenerateContext } from '../context/GenerateContext.js';
import { Definition } from '../dsl/Definition.js';
import type { TypeSystemObject } from '../types/TypeSystem.js';
import { FunctionParameter } from './FunctionParameter.js';
type ConstructorArgs = {
    context: GenerateContext;
    argName?: string;
    typeName: string;
    typeValue: TypeSystemObject;
    pathTemplate: string;
};
export declare class PathParams {
    context: GenerateContext;
    typeDefinition: Definition<TypeSystemObject>;
    parameter: FunctionParameter;
    path: string;
    constructor({ context, argName, typeName, typeValue, pathTemplate }: ConstructorArgs);
}
export {};
//# sourceMappingURL=PathParams.d.ts.map