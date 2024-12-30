"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatters = void 0;
exports.jsonFormatter = jsonFormatter;
function jsonFormatter(logRecord) {
    return JSON.stringify({
        level: logRecord.levelName,
        datetime: logRecord.datetime.getTime(),
        message: logRecord.msg,
        args: flattenArgs(logRecord.args),
    });
}
function flattenArgs(args) {
    if (args.length === 1) {
        return args[0];
    }
    else if (args.length > 1) {
        return args;
    }
}
exports.formatters = {
    jsonFormatter,
};
