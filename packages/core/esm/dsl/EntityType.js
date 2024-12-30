import { match } from 'ts-pattern';
export class EntityType {
    constructor(type) {
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.type = type;
    }
    toString() {
        return match(this.type)
            .with('variable', () => 'const')
            .with('type', () => 'type')
            .exhaustive();
    }
}
