import { EntityType } from './EntityType.js';
export declare class Identifier {
    name: string;
    entityType: EntityType;
    typeName?: string;
    private constructor();
    static createVariable(name: string, typeName?: string): Identifier;
    static createType(name: string): Identifier;
    toString(): string;
}
//# sourceMappingURL=Identifier.d.ts.map