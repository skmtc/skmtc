import { isIdentifierName } from '@babel/helper-validator-identifier';
export const handleKey = (key) => {
    return isIdentifierName(key) ? key : `'${key}'`;
};
export const handlePropertyName = (name, parent) => {
    return isIdentifierName(name) ? `${parent}.${name}` : `${parent}['${name}']`;
};
