export declare class Mark {
    name: string;
    buffer: string;
    position: number;
    line: number;
    column: number;
    constructor(name: string, buffer: string, position: number, line: number, column: number);
    getSnippet(indent?: number, maxLength?: number): string | null;
    toString(compact?: boolean): string;
}
//# sourceMappingURL=_mark.d.ts.map