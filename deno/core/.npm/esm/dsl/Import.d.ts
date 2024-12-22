type ConstructorArgs = {
    module: string;
    importNames: ImportNameArg[];
};
export declare class Import {
    module: string;
    importNames: ImportName[];
    constructor({ module, importNames }: ConstructorArgs);
    toRecord(): Record<string, ImportNameArg[]>;
    toString(): string;
}
export type ImportNameArg = string | {
    [name: string]: string;
};
export declare class ImportName {
    name: string;
    alias?: string;
    constructor(name: ImportNameArg);
    toString(): string;
}
export {};
//# sourceMappingURL=Import.d.ts.map