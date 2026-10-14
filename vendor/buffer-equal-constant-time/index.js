'use strict';
// buffer-equal-constant-time@1.0.1 は読み込み時に SlowBuffer.prototype を触るため、
// SlowBuffer が削除された Node 25 以降で落ちる（jwa → jws → google-auth-library 経由）。
// 同じ API を crypto.timingSafeEqual で実装し直したもの。package.json の overrides で差し替えている。
const { Buffer } = require('buffer');
const { timingSafeEqual } = require('crypto');

function bufferEq(a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) return false;
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const origBufEqual = Buffer.prototype.equal;

bufferEq.install = function () {
  Buffer.prototype.equal = function equal(that) {
    return bufferEq(this, that);
  };
};

bufferEq.restore = function () {
  Buffer.prototype.equal = origBufEqual;
};

module.exports = bufferEq;
