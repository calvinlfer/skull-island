'use strict';
const crypto = require('crypto');

module.exports = function uuidV3(inputString) {
  const result = crypto.createHash('md5').update(inputString).digest();
  const md5Bytes = new Buffer(result);

  md5Bytes[6] = md5Bytes[6] & 0x0f;
  md5Bytes[6] = md5Bytes[6] | 0x30;
  md5Bytes[8] = md5Bytes[8] & 0x3f;
  md5Bytes[8] = md5Bytes[8] | 0x80;

  const hexString = md5Bytes.hexSlice();

  return [
    hexString.substr(0, 8),
    hexString.substr(8, 4),
    hexString.substr(12, 4),
    hexString.substr(16, 4),
    hexString.substr(20)
  ].join('-');
};
