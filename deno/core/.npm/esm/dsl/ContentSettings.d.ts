import type { Identifier } from './Identifier.js';
type EmptyArgs = {
    exportPath: string;
    identifier: Identifier;
};
type CreateArgs = {
    identifier: Identifier;
    selected: boolean;
    exportPath: string;
};
export declare class ContentSettings {
    identifier: Identifier;
    selected: boolean;
    exportPath: string;
    constructor({ identifier, selected, exportPath }: CreateArgs);
    static empty({ identifier, exportPath }: EmptyArgs): ContentSettings;
}
export {};
//# sourceMappingURL=ContentSettings.d.ts.map