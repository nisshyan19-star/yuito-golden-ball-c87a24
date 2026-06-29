const test   = require('node:test');
const assert = require('node:assert');
const { frontTile, isWalkable, clampCamera, _withActiveNpcs } = require('../src/scenes/field-scene.js');
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

// ── ボス撃破→通路開放（回帰：倒したボスが残って通れないバグの再発防止）─────
//   field5 のゴーレムキーパー(7,9)は壁の帯 r9 の唯一の隙間を塞ぐ中ボス。
//   倒す前は通れず、倒す（vanishFlag=boss_guardian を立てる）と
//   _withActiveNpcs がそのNPCを除いた表示マップを作り、隙間が歩けるようになる。
const field5 = MAPS.field5;

test('回帰: field5 ゴーレムキーパー(7,9)は撃破前は通路を塞ぐ', () => {
  // 素のタイルは '.'（r9 = '#######.########' の唯一の隙間）だが NPC が塞ぐ。
  assert.strictEqual(isWalkable(field5, 7, 9, {}), false);
});

test('回帰: ボスを撃破(vanishFlag)すると キーパーNPCが消えて通路(7,9)が歩ける', () => {
  // 撃破でボスの vanishFlag(=boss_guardian) が立つ → 戦闘後にフィールド再構築で
  // _withActiveNpcs が呼ばれ、その NPC を除いた表示マップになる。
  const cleared = _withActiveNpcs(field5, { boss_guardian: true });
  // (7,9) に居たキーパーが除外されている。
  assert.ok(
    !(cleared.npcs || []).some((n) => n.x === 7 && n.y === 9),
    'キーパーNPCが除去されていない（撃破後も残っている）',
  );
  // 通路が開く＝隙間(7,9)が歩けるようになる。
  assert.strictEqual(isWalkable(cleared, 7, 9, {}), true);
});

test('回帰: vanishFlag が未設定なら キーパーは残り通路は塞がれたまま', () => {
  // flags が空（未撃破）なら除外されず、通路は塞がれたまま。
  const notCleared = _withActiveNpcs(field5, {});
  assert.ok(
    (notCleared.npcs || []).some((n) => n.x === 7 && n.y === 9),
    'キーパーNPCが消えてしまっている（未撃破なのに通れる）',
  );
  assert.strictEqual(isWalkable(notCleared, 7, 9, {}), false);
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
