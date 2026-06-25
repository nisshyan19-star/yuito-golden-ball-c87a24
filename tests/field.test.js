const test   = require('node:test');
const assert = require('node:assert');
const { frontTile, isWalkable, clampCamera } = require('../src/scenes/field-scene.js');
const { MAPS } = require('../src/data/maps.js');

const field1 = MAPS.field1;

// ── frontTile ────────────────────────────────────────────────────────

test('frontTile: up は y-1', () => {
  assert.deepStrictEqual(frontTile(5, 5, 'up'), { x: 5, y: 4 });
});
test('frontTile: down は y+1', () => {
  assert.deepStrictEqual(frontTile(5, 5, 'down'), { x: 5, y: 6 });
});
test('frontTile: left は x-1', () => {
  assert.deepStrictEqual(frontTile(5, 5, 'left'), { x: 4, y: 5 });
});
test('frontTile: right は x+1', () => {
  assert.deepStrictEqual(frontTile(5, 5, 'right'), { x: 6, y: 5 });
});

// ── isWalkable ───────────────────────────────────────────────────────

test('isWalkable: 草(.)タイルは歩ける', () => {
  // (5,5) は開始地点で '.'
  assert.strictEqual(isWalkable(field1, 5, 5, {}), true);
});

test('isWalkable: 道(,)タイルは歩ける', () => {
  // (3,2) は ',' （r2 = '#..,,,,,,,,,,..#'）
  assert.strictEqual(isWalkable(field1, 3, 2, {}), true);
});

test('isWalkable: 壁(#)タイルは歩けない', () => {
  // (0,0) は '#'
  assert.strictEqual(isWalkable(field1, 0, 0, {}), false);
});

test('isWalkable: 水(~)タイルは歩けない', () => {
  // (3,11) は '~' （r11 = '#..~~.,..,..~~.#'）
  assert.strictEqual(isWalkable(field1, 3, 11, {}), false);
});

test('isWalkable: 範囲外（負）は歩けない', () => {
  assert.strictEqual(isWalkable(field1, -1, 5, {}), false);
  assert.strictEqual(isWalkable(field1, 5, -1, {}), false);
});

test('isWalkable: 範囲外（超過）は歩けない', () => {
  assert.strictEqual(isWalkable(field1, 999, 5, {}), false);
  assert.strictEqual(isWalkable(field1, 5, 999, {}), false);
});

test('isWalkable: NPC が居るタイルは歩けない', () => {
  // NPC は (4,9)。素のタイルは '.' で本来歩けるが NPC が塞ぐ。
  assert.strictEqual(isWalkable(field1, 4, 9, {}), false);
});

test('isWalkable: 未開封の宝箱があるタイルは歩けない', () => {
  // 宝箱は (12,13)。opened なしなら塞がれる。
  assert.strictEqual(isWalkable(field1, 12, 13, {}), false);
});

test('isWalkable: 開封済みの宝箱タイルは歩ける', () => {
  // opened に該当 id があれば通れる。
  assert.strictEqual(isWalkable(field1, 12, 13, { field1_chest1: true }), true);
});

test('isWalkable: opened 省略でも宝箱は塞がる（デフォルト未開封扱い）', () => {
  assert.strictEqual(isWalkable(field1, 12, 13), false);
});

// ── clampCamera ──────────────────────────────────────────────────────

test('clampCamera: 地図が画面より小さい時は中央寄せ', () => {
  // screen=288, mapPx=200 → (288-200)/2 = 44。desired は無視される。
  assert.strictEqual(clampCamera(-100, 288, 200), 44);
  assert.strictEqual(clampCamera(0, 288, 200), 44);
});

test('clampCamera: 地図が画面と同じ時も中央寄せ(=0)', () => {
  assert.strictEqual(clampCamera(-50, 288, 288), 0);
});

test('clampCamera: 地図が大きい時は中間値そのまま', () => {
  // screen=288, mapPx=576 → 許容範囲 [-288, 0]。-100 はその中なのでそのまま。
  assert.strictEqual(clampCamera(-100, 288, 576), -100);
});

test('clampCamera: 上限(0)を超える desired は 0 にクランプ', () => {
  assert.strictEqual(clampCamera(50, 288, 576), 0);
});

test('clampCamera: 下限(screen-mapPx)を下回る desired はクランプ', () => {
  // 下限 = 288-576 = -288
  assert.strictEqual(clampCamera(-500, 288, 576), -288);
});
