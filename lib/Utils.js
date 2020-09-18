"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NullOutstreamStringWritable = exports.getCurrentTime = void 0;
const stream = require("stream");
class Utils {
    static IsEqual(a, b) {
        if (a !== undefined && a != null && b != null && b !== undefined) {
            return a.toLowerCase() == b.toLowerCase();
        }
        return false;
    }
}
exports.default = Utils;
exports.getCurrentTime = () => {
    return new Date().getTime().toString();
};
class NullOutstreamStringWritable extends stream.Writable {
    constructor(options) {
        super(options);
    }
    _write(data, encoding, callback) {
        if (callback) {
            callback();
        }
    }
}
exports.NullOutstreamStringWritable = NullOutstreamStringWritable;
;
