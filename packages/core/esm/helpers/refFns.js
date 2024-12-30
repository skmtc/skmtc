export const toRefName = ($ref) => {
    // TODO: Add validation here to ensure reference exists
    const refName = $ref.split('/').slice(-1)[0];
    if (!refName) {
        throw new Error('Invalid reference');
    }
    return refName;
};
export const isRef = (value) => {
    if (value &&
        typeof value === 'object' &&
        '$ref' in value &&
        typeof value.$ref === 'string') {
        return true;
    }
    else {
        return false;
    }
};
