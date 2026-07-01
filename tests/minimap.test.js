'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { minimapCell } = require('../src/scenes/field-scene.js');

// テスト専用のモック凡例（実データに依存しない）
const LEGEND = {
  '.': { walkable: true },
  '#': { walkable: false },
  '~': { walkable: false },
  'H': { walkable: true, secret: true }, // 隠し通路
};

const GRID = [
  '###',
  '#.#',
  '#H#',
];

test('歩けるタイルは floor', () => {
  assert.strictEqual(minimapCell(GRID, 1, 1, LEGEND), 'floor');
});

test('壁は wall', () => {
  assert.strictEqual(minimapCell(GRID, 0, 0, LEGEND), 'wall');
});

test('隠し通路(secret)は壁として丸める（露出しない）', () => {
  assert.strictEqual(minimapCell(GRID, 1, 2, LEGEND), 'wall');
});

test('範囲外(x<0)は wall', () => {
  assert.strictEqual(minimapCell(GRID, -1, 1, LEGEND), 'wall');
});

test('範囲外(y>=rows)は wall', () => {
  assert.strictEqual(minimapCell(GRID, 1, 99, LEGEND), 'wall');
});

test('凡例に無い文字は wall（安全側）', () => {
  assert.strictEqual(minimapCell(['?'], 0, 0, LEGEND), 'wall');
});

test('grid が空/未定義でも落ちず wall', () => {
  assert.strictEqual(minimapCell(null, 0, 0, LEGEND), 'wall');
  assert.strictEqual(minimapCell([], 0, 0, LEGEND), 'wall');
});
