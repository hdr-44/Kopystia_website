import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from './validate.ts';

const base = { type: 'custom', name: 'Оля', contact: 'olia@example.com', description: 'Хочу фетровий капелюх', item: '', website: '' };
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);

test('accepts a valid custom inquiry', () => assert.equal(validate(base).ok, true));
test('rejects missing name and contact', () => {
  const r = validate({ ...base, name: ' ', contact: '' });
  assert.ok(!r.ok && r.errors.name && r.errors.contact);
});
test('description required for custom, optional for certificate', () => {
  assert.equal(validate({ ...base, description: '' }).ok, false);
  assert.equal(validate({ ...base, type: 'certificate', item: '$300', description: '' }).ok, true);
});
test('rejects unknown type and honeypot', () => {
  assert.equal(validate({ ...base, type: 'x' }).ok, false);
  assert.equal(validate({ ...base, website: 'spam.com' }).ok, false);
});
test('image: accepts png, rejects fake and oversized', () => {
  assert.equal(validate(base, { bytes: png, name: 'a.png' }).ok, true);
  assert.equal(validate(base, { bytes: new TextEncoder().encode('<script>'), name: 'a.png' }).ok, false);
  assert.equal(validate(base, { bytes: new Uint8Array(6 * 1024 * 1024).fill(0xff), name: 'a.jpg' }).ok, false);
});
