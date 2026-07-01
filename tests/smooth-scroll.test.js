'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { lerp, stepEase } = require('../src/scenes/field-scene.js');

test('lerp: t=0 は始点を返す', () => {
  assert.strictEqual(lerp(2, 10, 0), 2);
});

test('lerp: t=1 は終点を返す', () => {
  assert.strictEqual(lerp(2, 10, 1), 10);
});

test('lerp: t=0.5 は中点', () => {
  assert.strictEqual(lerp(0, 10, 0.5), 5);
});

test('lerp: 負方向にも線形', () => {
  assert.strictEqual(lerp(10, 2, 0.5), 6);
});

test('stepEase: 0 で 0、1 で 1（境界クランプ）', () => {
  assert.strictEqual(stepEase(0), 0);
  assert.strictEqual(stepEase(1), 1);
});

test('stepEase: 0未満/1超はクランプ', () => {
  assert.strictEqual(stepEase(-0.5), 0);
  assert.strictEqual(stepEase(1.5), 1);
});

test('stepEase: easeOut（中間は線形より速い＝0.5で0.5超）', () => {
  const v = stepEase(0.5);
  assert.ok(v > 0.5, 'easeOut は 0.5 時点で 0.5 を超える, got ' + v);
  assert.ok(v < 1, 'まだ 1 未満, got ' + v);
});

test('stepEase: 単調増加', () => {
  let prev = -1;
  for (let i = 0; i <= 10; i++) {
    const v = stepEase(i / 10);
    assert.ok(v >= prev, '単調増加でない at ' + (i / 10));
    prev = v;
  }
});
