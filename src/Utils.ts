"use strict";
import stream = require('stream');

export default class Utils {
    public static IsEqual(a: string, b: string): boolean {
        if (a !== undefined && a != null && b != null && b !== undefined) {
            return a.toLowerCase() == b.toLowerCase();
        }
        return false;
    }
}

export const getCurrentTime = (): string => {
    return new Date().getTime().toString();
}

export class NullOutstreamStringWritable extends stream.Writable {

    constructor(options: any) {
        super(options);
    }

    _write(data: any, encoding: string, callback: Function): void {
        if (callback) {
            callback();
        }
    }
};