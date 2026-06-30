'use strict';

// 動き・演出レイヤー（マップの彩り）: _ambientFor のテーマ決定ロジックを検証する。
// 描画そのものは canvas 依存なので、ここでは「どのテーマを選ぶか」の純粋判定だけを固める。

const test = require('node:test');
const assert = require('node:assert');

// field-scene.js を CommonJS として読み込む（module.exports = api）。
const field = require('../src/scenes/field-scene.js');

test('_ambientFor がエクスポートされている', () => {
  assert.strictEqual(typeof field._ambientFor, 'function');
});

test('テーマ未指定の通常マップは petals（さくら）が既定', () => {
  assert.strictEqual(field._ambientFor({}), 'petals');
  assert.strictEqual(field._ambientFor({ name: 'どこかの町' }), 'petals');
});

test('dark マップでテーマ未指定なら embers（火の粉）が既定', () => {
  assert.strictEqual(field._ambientFor({ dark: true }), 'embers');
});

test('ambient を明示したらそれを最優先で使う', () => {
  assert.strictEqual(field._ambientFor({ ambient: 'rain' }), 'rain');
  assert.strictEqual(field._ambientFor({ ambient: 'snow' }), 'snow');
});

test('ambient は dark 既定よりも優先される', () => {
  assert.strictEqual(field._ambientFor({ dark: true, ambient: 'night' }), 'night');
});

test('引数が null/undefined でも落ちず petals を返す', () => {
  assert.strictEqual(field._ambientFor(null), 'petals');
  assert.strictEqual(field._ambientFor(undefined), 'petals');
});
