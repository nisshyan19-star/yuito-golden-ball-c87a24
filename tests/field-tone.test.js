'use strict';
// 彩り（Phase 2）：テーマ別の色トーン _toneFor の純粋ロジックを検証する。
// 描画自体（_drawToneOverlay / _drawAmbientLife / オブジェクトのゆれ）はブラウザ目視。
const test = require('node:test');
const assert = require('node:assert');
const F = require('../src/scenes/field-scene.js');

test('_toneFor がエクスポートされている', () => {
  assert.strictEqual(typeof F._toneFor, 'function');
});

test('夜は深い青みのトーン', () => {
  const t = F._toneFor('night');
  assert.match(t, /^rgba\(/, '夜は色トーンを返す');
});

test('火の粉(embers)は赤みのトーン（赤成分が最大）', () => {
  const m = F._toneFor('embers').match(/rgba\((\d+),(\d+),(\d+)/);
  assert.ok(m, 'rgba 形式');
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  assert.ok(r > g && r > b, '赤が最も強い: ' + F._toneFor('embers'));
});

test('夜(night)は青みのトーン（青成分が最大）', () => {
  const m = F._toneFor('night').match(/rgba\((\d+),(\d+),(\d+)/);
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  assert.ok(b > r && b > g, '青が最も強い: ' + F._toneFor('night'));
});

test('各テーマで rgba を返す（petals 含む）', () => {
  for (const th of ['night', 'rain', 'snow', 'embers', 'sky', 'sand', 'leaves', 'petals']) {
    assert.match(F._toneFor(th), /^rgba\(/, th + ' は色を返す');
  }
});

test('未知テーマ/未指定は空文字（色を足さない）', () => {
  assert.strictEqual(F._toneFor('unknown'), '');
  assert.strictEqual(F._toneFor(), '');
});
