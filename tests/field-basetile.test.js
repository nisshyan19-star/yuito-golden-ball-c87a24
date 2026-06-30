'use strict';
// Phase7-①「土台」：ベースタイルの全コード化＋ふちどり(autotile)一般化の純粋ロジック検証。
//   実際の描画（_drawBaseTile 等）は canvas 依存なのでブラウザ目視。ここでは
//     ・ふちどりの汎用マスク _neighborMask（任意の判定関数で上右下左ビット）
//     ・既存 _waterEdgeMask が _neighborMask と同値（後方互換）
//     ・新しいベースタイルが TILE_LEGEND に通行フラグ付きで定義されている
//   を機械的に確認する。
const test = require('node:test');
const assert = require('node:assert');
const F = require('../src/scenes/field-scene.js');
const { TILE_LEGEND } = require('../src/data/maps.js');

test('_neighborMask は判定関数に合うマスだけ上右下左ビットで返す', () => {
  // 中央(1,1)の上下左右を個別に対象タイル X にして、対応ビットが立つか確認。
  const up    = ['.X.', '...', '...'];
  const right = ['...', '..X', '...'];
  const down  = ['...', '...', '.X.'];
  const left  = ['...', 'X..', '...'];
  const isX = (ch) => ch === 'X';
  assert.strictEqual(F._neighborMask(up, 1, 1, isX) & 1, 1, '上=bit1');
  assert.strictEqual(F._neighborMask(right, 1, 1, isX) & 2, 2, '右=bit2');
  assert.strictEqual(F._neighborMask(down, 1, 1, isX) & 4, 4, '下=bit4');
  assert.strictEqual(F._neighborMask(left, 1, 1, isX) & 8, 8, '左=bit8');
});

test('_neighborMask は盤面の外を「対象でない」扱いにする（範囲外で落ちない）', () => {
  const grid = ['XXX', 'X.X', 'XXX'];
  const isX = (ch) => ch === 'X';
  const m = F._neighborMask(grid, 0, 0, isX); // 角(0,0)：上・左は範囲外
  assert.strictEqual(m & 1, 0, '上(範囲外)は対象でない');
  assert.strictEqual(m & 8, 0, '左(範囲外)は対象でない');
  assert.strictEqual(m & 2, 2, '右は対象');
  assert.strictEqual(m & 4, 4, '下は対象');
});

test('_waterEdgeMask は _neighborMask(水判定) と同値（後方互換）', () => {
  const grids = [
    ['.r.', '~.~', '.~.'],
    ['~~~', '~.~', '~~~'],
    ['...', '...', '...'],
    ['.#.', '#r#', '.#.'],
  ];
  const isWater = (ch) => ch === '~' || ch === 'r';
  for (const g of grids) {
    for (let r = 0; r < g.length; r++) {
      for (let c = 0; c < g[r].length; c++) {
        assert.strictEqual(
          F._waterEdgeMask(g, r, c),
          F._neighborMask(g, r, c, isWater),
          'edge mask が一致: (' + r + ',' + c + ')'
        );
      }
    }
  }
});

test('新ベースタイルが TILE_LEGEND に正しい通行フラグで定義されている', () => {
  // 通行できる地面系
  assert.strictEqual(TILE_LEGEND['s'].walkable, true, '砂(s)は通れる');
  assert.strictEqual(TILE_LEGEND['w'].walkable, true, '雪(w)は通れる');
  assert.strictEqual(TILE_LEGEND['='].walkable, true, '石だたみ(=)は通れる');
  assert.strictEqual(TILE_LEGEND['P'].walkable, true, '木の床(P)は通れる');
  assert.strictEqual(TILE_LEGEND['c'].walkable, true, '洞窟床(c)は通れる');
  // 通行できない壁/危険
  assert.strictEqual(TILE_LEGEND['W'].walkable, false, '深い水(W)は通れない');
  assert.strictEqual(TILE_LEGEND['C'].walkable, false, '洞窟壁(C)は通れない');
  assert.strictEqual(TILE_LEGEND['L'].walkable, false, '溶岩(L)は通れない');
});

test('新ベースタイルの sprite 名が割り当たっている', () => {
  assert.strictEqual(TILE_LEGEND['s'].sprite, 't_sand');
  assert.strictEqual(TILE_LEGEND['w'].sprite, 't_snow');
  assert.strictEqual(TILE_LEGEND['W'].sprite, 't_deepwater');
  assert.strictEqual(TILE_LEGEND['='].sprite, 't_cobble');
  assert.strictEqual(TILE_LEGEND['P'].sprite, 't_wood');
  assert.strictEqual(TILE_LEGEND['c'].sprite, 't_cavefloor');
  assert.strictEqual(TILE_LEGEND['C'].sprite, 't_cavewall');
  assert.strictEqual(TILE_LEGEND['L'].sprite, 't_lava');
});
