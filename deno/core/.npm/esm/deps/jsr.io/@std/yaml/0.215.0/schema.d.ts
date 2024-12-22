import type { KindType, Type } from "./type.js";
import type { Any, ArrayObject } from "./_utils.js";
export type TypeMap = {
    [k in KindType | "fallback"]: ArrayObject<Type>;
};
export declare class Schema implements SchemaDefinition {
    static SCHEMA_DEFAULT?: Schema;
    implicit: Type[];
    explicit: Type[];
    include: Schema[];
    compiledImplicit: Type[];
    compiledExplicit: Type[];
    compiledTypeMap: TypeMap;
    constructor(definition: SchemaDefinition);
    extend(definition: SchemaDefinition): Schema;
    static create(): void;
}
export interface SchemaDefinition {
    implicit?: Any[];
    explicit?: Type[];
    include?: Schema[];
}
//# sourceMappingURL=schema.d.ts.map