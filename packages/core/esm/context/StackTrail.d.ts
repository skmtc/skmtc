export declare class StackTrail {
    #private;
    constructor(stack?: (string | number)[]);
    clone(): StackTrail;
    slice(start: number, end?: number): StackTrail;
    get stackTrail(): (string | number)[];
    append(frame: string | string[]): StackTrail;
    getParentOf(frame: string): string | undefined;
    remove(frame: string | string[]): StackTrail;
    static join(...stacks: (StackTrail | string)[]): string;
    static parse(value: string): StackTrail;
    toString(): string;
}
//# sourceMappingURL=StackTrail.d.ts.map