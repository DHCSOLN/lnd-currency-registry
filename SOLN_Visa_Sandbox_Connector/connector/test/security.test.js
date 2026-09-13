import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalRequest, signRequest, safeEqual, redact } from '../src/security.js';

test('canonical request and HMAC are stable', () => {
  const canonical = canonicalRequest('1', 'nonce', 'post', '/v1/payouts', '{"a":1}');
  assert.equal(signRequest('secret', canonical), signRequest('secret', canonical));
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
});

test('sensitive recipient fields are redacted', () => {
  const value = redact({ recipient: { accountNumber: '123', firstName: 'A' }, amount: 2 });
  assert.equal(value.recipient.accountNumber, '[REDACTED]');
  assert.equal(value.recipient.firstName, '[REDACTED]');
  assert.equal(value.amount, 2);
});
