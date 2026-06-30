'use strict';
// 弾6：DQ風の地形タイル（森/川/橋/岩/花畑）＋ふちどり（autotile）の純粋ロジックを検証する。
// 実際の描画（_drawTreeTile 等）は canvas 依存なのでブラウザ目視。ここでは
//   ・新タイルの legend 定義（通行可否）
//   ・proc タイル判定 _isProcTile と下地 _procBaseSprite
//   ・水ぎわビットマスク _waterEdgeMask
//   ・field2 が 18×16 のまま & 主要マスが歩ける
// を機械的に確認する。
const test = require('node:test');
const assert = require('node:assert');
const F = require('../src/scenes/field-scene.js');
const { MAPS, TILE_LEGEND } = require('../src/data/maps.js');

test('新タイルが TILE_LEGEND に正しい通行フラグで定義されている', () => {
  // 森/川/岩は通行不可、橋/花畑は通行可。
  assert.strictEqual(TILE_LEGEND['T'].walkable, false, '森(T)は通れない');
  assert.strictEqual(TILE_LEGEND['r'].walkable, false, '川(r)は通れない');
  assert.strictEqual(TILE_LEGEND['R'].walkable, false, '岩(R)は通れない');
  assert.strictEqual(TILE_LEGEND['b'].walkable, true, '橋(b)は通れる');
  assert.strictEqual(TILE_LEGEND['f'].walkable, true, '花畑(f)は通れる');
});

test('新タイルの sprite 名が割り当たっている', () => {
  assert.strictEqual(TILE_LEGEND['T'].sprite, 't_tree');
  assert.strictEqual(TILE_LEGEND['r'].sprite, 't_river');
  assert.strictEqual(TILE_LEGEND['b'].sprite, 't_bridge');
  assert.strictEqual(TILE_LEGEND['R'].sprite, 't_rock');
  assert.strictEqual(TILE_LEGEND['f'].sprite, 't_flower');
});

test('_isProcTile はコード手描きタイルだけ true を返す', () => {
  for (const s of ['t_tree', 't_river', 't_bridge', 't_rock', 't_flower']) {
    assert.strictEqual(F._isProcTile(s), true, s + ' は proc');
  }
  for (const s of ['t_grass', 't_water', 't_road', 't_wall', 't_floor', undefined]) {
    assert.strictEqual(F._isProcTile(s), false, s + ' は proc ではない');
  }
});

test('_procBaseSprite は川/橋は水・それ以外は草を下地にする', () => {
  assert.strictEqual(F._procBaseSprite('t_river'), 't_water');
  assert.strictEqual(F._procBaseSprite('t_bridge'), 't_water');
  assert.strictEqual(F._procBaseSprite('t_tree'), 't_grass');
  assert.strictEqual(F._procBaseSprite('t_rock'), 't_grass');
  assert.strictEqual(F._procBaseSprite('t_flower'), 't_grass');
});

test('_waterEdgeMask は隣接する水(~)/川(r)を上右下左ビットで返す', () => {
  // 中央(1,1)の上下左右を個別に水にして、対応ビットが立つか確認。
  const up    = ['.~.', '...', '...'];
  const right = ['...', '..~', '...'];
  const down  = ['...', '...', '.~.'];
  const left  = ['...', '~..', '...'];
  assert.strictEqual(F._waterEdgeMask(up, 1, 1) & 1, 1, '上=bit1');
  assert.strictEqual(F._waterEdgeMask(right, 1, 1) & 2, 2, '右=bit2');
  assert.strictEqual(F._waterEdgeMask(down, 1, 1) & 4, 4, '下=bit4');
  assert.strictEqual(F._waterEdgeMask(left, 1, 1) & 8, 8, '左=bit8');
});

test('_waterEdgeMask は川(r)も水とみなす／無関係タイルは無視', () => {
  const grid = ['.r.', '.X.', '...']; // 上が川 r、それ以外は陸/別タイル
  assert.strictEqual(F._waterEdgeMask(grid, 1, 1), 1, '川も水扱い＝上ビットのみ');
  const dry = ['.#.', '#.#', '.#.']; // まわりは壁 → どこも水でない
  assert.strictEqual(F._waterEdgeMask(dry, 1, 1), 0, '壁は水でない＝0');
});

test('_waterEdgeMask は盤面の外を水でない扱いにする（範囲外で落ちない）', () => {
  const grid = ['~~~', '~.~', '~~~']; // 角(0,0)の上・左は範囲外
  const m = F._waterEdgeMask(grid, 0, 0);
  assert.strictEqual(m & 1, 0, '上(範囲外)は水でない');
  assert.strictEqual(m & 8, 0, '左(範囲外)は水でない');
  assert.strictEqual(m & 2, 2, '右は水');
  assert.strictEqual(m & 4, 4, '下は水');
});

test('field2 は 18行×16列のまま', () => {
  const g = MAPS.field2.grid;
  assert.strictEqual(g.length, 18, 'field2 は18行');
  for (let i = 0; i < g.length; i++) {
    assert.strictEqual(g[i].length, 16, 'field2 r' + i + ' は16列');
  }
});

test('field2 の縦の通り道（col7）と橋・コンベアが歩ける', () => {
  const g = MAPS.field2.grid;
  // 川の行(r5)では橋(b)だけが col7 にあり、そこを渡れる。
  assert.strictEqual(g[5].charAt(7), 'b', 'r5 col7 は橋');
  assert.strictEqual(TILE_LEGEND[g[5].charAt(7)].walkable, true, '橋は歩ける');
  // 動く床（コンベア）のマスが歩ける。
  for (const ry of [12, 13, 14]) {
    assert.strictEqual(TILE_LEGEND[g[ry].charAt(7)].walkable, true, 'r' + ry + ' col7 は歩ける');
  }
  // 到着(7,2)・出口(7,16)が歩ける。
  assert.strictEqual(TILE_LEGEND[g[2].charAt(7)].walkable, true, '到着(7,2)は歩ける');
  assert.strictEqual(TILE_LEGEND[g[16].charAt(7)].walkable, true, '出口(7,16)は歩ける');
});

test('field2 の NPC/宝箱マスが歩ける（オブジェクトの足場がある）', () => {
  const g = MAPS.field2.grid;
  const cells = [[8, 4], [8, 11], [11, 9], [11, 12]]; // [row,col]
  for (const [ry, cx] of cells) {
    assert.strictEqual(TILE_LEGEND[g[ry].charAt(cx)].walkable, true,
      '(' + cx + ',' + ry + ') は歩ける');
  }
});
