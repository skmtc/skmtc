import type { Definition } from './Definition.js';
import type { GeneratorKey } from '../types/GeneratorKeys.js';
import type { ClientSettings, ModulePackage } from '../types/Settings.js';
type FileArgs = {
    path: string;
    settings: ClientSettings | undefined;
};
export declare class File {
    #private;
    path: string;
    reExports: Map<string, Record<string, Set<string>>>;
    imports: Map<string, Set<string>>;
    definitions: Map<string, Definition>;
    packages: ModulePackage[] | undefined;
    constructor({ path, settings }: FileArgs);
    get generatorKeys(): Set<GeneratorKey>;
    toString(): string;
}
export type NormaliseModuleNameArgs = {
    destinationPath: string;
    exportPath: string;
    packages: ModulePackage[] | undefined;
};
export declare const normaliseModuleName: ({ destinationPath, exportPath, packages }: NormaliseModuleNameArgs) => string;
export {};
//# sourceMappingURL=File.d.ts.map