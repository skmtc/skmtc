import { EMPTY } from '../dsl/constants.js';
// Filter out properties with falsy or EMPTY values and return as joined string
export const keyValues = (properties) => {
    const filteredEntries = Object.entries(properties)
        .map(([key, value]) => {
        const renderedValue = value?.toString() || EMPTY;
        return renderedValue === EMPTY ? EMPTY : `${key}: ${renderedValue}`;
    })
        .filter(row => row !== EMPTY);
    return filteredEntries.length ? `{${filteredEntries.join(',\n')}}` : EMPTY;
};
