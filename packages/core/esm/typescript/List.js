import { match } from 'ts-pattern';
export class List {
    constructor(values, { separator, bookends } = {}) {
        Object.defineProperty(this, "values", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "separator", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "bookends", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.values = values.filter(value => value !== undefined);
        this.separator = separator ?? ', ';
        this.bookends = bookends ?? 'none';
    }
    toString() {
        const joined = this.values.join(this.separator);
        return match(this.bookends)
            .with('[]', () => `[${joined}]`)
            .with('{}', () => `{${joined}}`)
            .with('()', () => `(${joined})`)
            .with('<>', () => `<${joined}>`)
            .with('none', () => joined)
            .exhaustive();
    }
}
/**
 * Create an empty List that will render as an empty string ''
 * @returns List
 */
Object.defineProperty(List, "toEmpty", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: () => {
        return new List([], { bookends: 'none' });
    }
});
/**
 * Create a List with a single value that will render as `value`
 * @param value
 * @returns List
 */
Object.defineProperty(List, "toSingle", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (value) => {
        return new List([value], { bookends: 'none' });
    }
});
/**
 * If condition is true, return a List with a single value that will render as `value`.
 * Otherwise, return an empty List that will render as an empty string ''.
 *
 * Useful for conditional rendering. For example, rendering a function arg object when
 * it has at least one property.
 * @param value
 * @param condition
 * @returns List
 */
Object.defineProperty(List, "toConditional", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (value, condition) => {
        const out = new List([condition ? value : undefined], { bookends: 'none' });
        return out;
    }
});
/**
 * Create a record with Stringable values. KeyValue pairs will be joined with `: ` as separator
 * and the resulting List will be wrapped with `{}`
 * @param record
 * @returns `record` with `Stringable` values
 */
Object.defineProperty(List, "toRecord", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (record) => {
        const entries = Object.entries(record).map(([key, value]) => {
            return List.toKeyValue(key, value);
        });
        return List.toObject(entries);
    }
});
/**
 * Create a record with `undefined` or empty array or List values filtered out.
 * @param record
 * @returns `record` with `undefined` values filtered out
 */
Object.defineProperty(List, "toFilteredRecord", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (record) => {
        const entries = Object.entries(record).map(([key, value]) => {
            return List.toFilteredKeyValue(key, value);
        });
        return List.toObject(entries);
    }
});
/**
 * Join `key` and `value` using `: ` as separator
 * @param key
 * @param value
 * @returns `key` and `value` joined with `: ` as separator
 */
Object.defineProperty(List, "toKeyValue", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (key, value) => {
        return new List([key, value], { separator: ': ' });
    }
});
/**
 * Join `key` and `value` using `.` as separator
 * @param key
 * @param value
 * @returns `key` and `value` joined with `.` as separator
 */
Object.defineProperty(List, "toObjectKey", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (key, value) => {
        return new List([key, value], {
            separator: '.'
        });
    }
});
/**
 * Join `values` using `, ` as separator and wrap in `{` and `}`
 * @param values
 * @returns `values` joined with `, ` as separator and wrapped in `{` and `}`
 */
Object.defineProperty(List, "toObject", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (values) => {
        return new List(values, { bookends: '{}' });
    }
});
/**
 * Join `values` using `, ` as separator and wrap in `[` and `]`
 * @param values
 * @returns `values` joined with `, ` as separator and wrapped in `{` and `}`
 */
Object.defineProperty(List, "toArray", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (values) => {
        return new List(values, { bookends: '[]' });
    }
});
/**
 * Join `values` using `, ` as separator and wrap in `(` and `)`
 * @param values
 * @returns `values` joined with `, ` as separator and wrapped in `(` and `)`
 */
Object.defineProperty(List, "toParams", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (values) => {
        return new List(values, { bookends: '()' });
    }
});
/**
 * Join `values` using `\n` as separator without a wrapper
 * @param values
 * @returns `values` joined with `\n` as separator without a wrapper
 */
Object.defineProperty(List, "toLines", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (values) => {
        return new List(values, { separator: '\n' });
    }
});
/**
 * Create a KeyList using the keys of @param record
 * @afdafg
 * @param record
 * @returns KeyList
 */
Object.defineProperty(List, "fromKeys", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (record) => {
        return new KeyList(Object.keys(record ?? {}));
    }
});
/**
 * Create a EntryList using the entries of @param record
 * @afdafg
 * @param record
 * @returns EntryList
 */
Object.defineProperty(List, "fromEntries", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (record) => {
        return new EntryList(Object.entries(record ?? {}));
    }
});
/**
 * Create a keyValue pair if `value` is not undefined and is not an empty array or List.
 * Return `undefined` otherwise.
 *
 * Useful for filtering out `undefined values from a record.
 * @param key
 * @param value
 * @returns `key` and `value` joined with `: ` as separator if `value` is not undefined and is not an empty array or List. `undefined` otherwise.
 */
Object.defineProperty(List, "toFilteredKeyValue", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (key, value) => {
        const out = List.hasValue(value) ? List.toKeyValue(key, value) : undefined;
        return out;
    }
});
/**
 * Check if `value` is not undefined and is not an empty array or List.
 * @param value
 * @returns `true` if `value` is not undefined and is not an empty array or List. `false` otherwise.
 */
Object.defineProperty(List, "hasValue", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (value) => {
        if (value === undefined) {
            return false;
        }
        if (Array.isArray(value)) {
            return value.length > 0;
        }
        if (value instanceof List) {
            return List.hasValue(value.values);
        }
        return true;
    }
});
export class KeyList {
    constructor(keys) {
        Object.defineProperty(this, "keys", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.keys = keys;
    }
    toObject(mapFn) {
        return List.toObject(this.keys.map((key, index) => mapFn(key, index)));
    }
    toObjectPlain() {
        return List.toObject(this.keys);
    }
    toLines(mapFn) {
        return List.toLines(this.keys.map((key, index) => mapFn(key, index)));
    }
    toLinesPlain() {
        return List.toLines(this.keys);
    }
}
export class EntryList {
    constructor(entries) {
        Object.defineProperty(this, "entries", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.entries = entries;
    }
    toObject(mapFn) {
        return List.toObject(this.entries.map((entry, index) => mapFn(entry, index)));
    }
    toLines(mapFn) {
        return List.toLines(this.entries.map((key, index) => mapFn(key, index)));
    }
    toArray(mapFn) {
        return List.toArray(this.entries.map((entry, index) => mapFn(entry, index)));
    }
}
