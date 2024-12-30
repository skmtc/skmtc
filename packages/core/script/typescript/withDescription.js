"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withDescription = void 0;
const withDescription = (value, { description }) => {
    return description ? `/** ${description} */\n${value}` : `${value}`;
};
exports.withDescription = withDescription;
