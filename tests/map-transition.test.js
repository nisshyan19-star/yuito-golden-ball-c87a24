'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { fadeAlpha, flashAlpha } = require('../src/scenes/field-scene.js');

// fadeAlpha(remain, total): 黒オーバーレイ不透明度 0..1。
//   残りフェード秒 remain が total のとき 1（真っ黒）、0 のとき 0（透明）。
test('fadeAlpha: remain=total で 1（真っ黒）', () => {
  assert.strictEqual(fadeAlpha(0.35, 0.35), 1);
});
test('fadeAlpha: remain=0 で 0（透明）', () => {
  assert.strictEqual(fadeAlpha(0, 0.35), 0);
});
test('fadeAlpha: 中間は線形', () => {
  assert.strictEqual(fadeAlpha(0.2, 0.4), 0.5);
});
test('fadeAlpha: 範囲外はクランプ', () => {
  assert.strictEqual(fadeAlpha(-1, 0.4), 0);
  assert.strictEqual(fadeAlpha(1, 0.4), 1);
});
test('fadeAlpha: total<=0 は 0', () => {
  assert.strictEqual(fadeAlpha(0.2, 0), 0);
});

// flashAlpha(remain, total): マップ名フラッシュ不透明度。
//   序盤(残り40%まで)は 1 で見せきり、残り40%から線形に 0 へ消える。
test('flashAlpha: remain=total で 1', () => {
  assert.strictEqual(flashAlpha(1.2, 1.2), 1);
});
test('flashAlpha: remain=0 で 0', () => {
  assert.strictEqual(flashAlpha(0, 1.2), 0);
});
test('flashAlpha: 残り40%より上はずっと 1', () => {
  assert.strictEqual(flashAlpha(0.4, 1.0), 1);
});
test('flashAlpha: 残り40%地点から下は線形に減衰', () => {
  assert.strictEqual(flashAlpha(0.2, 1.0), 0.5);
});
test('flashAlpha: total<=0 は 0', () => {
  assert.strictEqual(flashAlpha(0.2, 0), 0);
});
