const test = require('node:test');
const assert = require('node:assert');
const { makeRng } = require('../src/core/rng.js');

test('同じシードなら同じ列を返す（再現性）', () => {
  const a = makeRng(123), b = makeRng(123);
  assert.strictEqual(a.next(), b.next());
});

test('rangeInt は min..max に収まる', () => {
  const r = makeRng(1);
  for (let i = 0; i < 200; i++) {
    const v = r.rangeInt(1, 6);
    assert.ok(v >= 1 && v <= 6, `range外: ${v}`);
  }
});

test('chance(1) は常に true, chance(0) は常に false', () => {
  const r = makeRng(7);
  assert.strictEqual(r.chance(1), true);
  assert.strictEqual(r.chance(0), false);
});
