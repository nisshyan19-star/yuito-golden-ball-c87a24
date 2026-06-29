// === map-gimmicks.test.js（追加弾2：マップギミック増強） ===
// ワープ／動く床（ベルトコンベア）／押しブロック（倉庫番）／暗闇マップの
// 純粋関数の判定ロジックと、実マップデータの整合性（踏める座標か・連鎖暴走
// しないか・パズルが解ける配置か・隠しマップが存在するか）を検証する。
const test   = require('node:test');
const assert = require('node:assert');
const {
  warpAt, conveyorAt, puzzleSolved, tryPushBlock, isWalkable,
} = require('../src/scenes/field-scene.js');
const { MAPS, TILE_LEGEND } = require('../src/data/maps.js');

// ── 合成マップ：押しブロック判定の検証用（'.'=床, '#'=壁） ──────────────
function synthMap(extra) {
  var m = {
    id: 'synth',
    grid: [
      '#####',
      '#...#',
      '#...#',
      '#...#',
      '#####',
    ],
    npcs: [], chests: [], objects: [],
  };
  if (extra) for (var k in extra) m[k] = extra[k];
  return m;
}

// ── warpAt ───────────────────────────────────────────────────────────
test('warpAt: ワープマスを返し、無い座標は null', () => {
  const map = { warps: [{ x: 3, y: 4, tx: 1, ty: 1 }] };
  assert.deepStrictEqual(warpAt(map, 3, 4), { x: 3, y: 4, tx: 1, ty: 1 });
  assert.strictEqual(warpAt(map, 1, 1), null);
  assert.strictEqual(warpAt({}, 0, 0), null);          // warps 未定義でも安全
});

// ── conveyorAt ───────────────────────────────────────────────────────
test('conveyorAt: 動く床マスを返し、無い座標は null', () => {
  const map = { conveyors: [{ x: 7, y: 12, dir: 'down' }] };
  assert.deepStrictEqual(conveyorAt(map, 7, 12), { x: 7, y: 12, dir: 'down' });
  assert.strictEqual(conveyorAt(map, 7, 13), null);
  assert.strictEqual(conveyorAt({}, 0, 0), null);
});

// ── puzzleSolved（倉庫番クリア判定） ──────────────────────────────────
test('puzzleSolved: 全ゴールにブロックが乗ったら true', () => {
  const goals  = [{ x: 2, y: 10 }, { x: 4, y: 10 }];
  // 未解決（ゴール上にブロックなし）
  assert.strictEqual(puzzleSolved([{ x: 2, y: 8 }, { x: 4, y: 8 }], goals), false);
  // 片方だけ（部分一致は未解決）
  assert.strictEqual(puzzleSolved([{ x: 2, y: 10 }, { x: 4, y: 8 }], goals), false);
  // 全ゴール一致 → 解決
  assert.strictEqual(puzzleSolved([{ x: 2, y: 10 }, { x: 4, y: 10 }], goals), true);
  // ゴールが空＝パズル未設定は未解決扱い
  assert.strictEqual(puzzleSolved([{ x: 2, y: 10 }], []), false);
});

// ── tryPushBlock（押しブロック） ──────────────────────────────────────
test('tryPushBlock: 正面にブロックが無ければ null（通常移動へ）', () => {
  const map = synthMap();
  assert.strictEqual(tryPushBlock(map, [], 2, 1, 'down'), null);
});

test('tryPushBlock: 押し先が床なら押せる（index/座標を返す）', () => {
  const map = synthMap();
  // (2,1) から下 → 正面(2,2)にブロック → 押し先(2,3)は床なので押せる
  const r = tryPushBlock(map, [{ x: 2, y: 2 }], 2, 1, 'down');
  assert.deepStrictEqual(r, { pushable: true, index: 0, x: 2, y: 3 });
});

test('tryPushBlock: 押し先が壁なら押せない', () => {
  const map = synthMap();
  // (2,2) から下 → 正面(2,3)にブロック → 押し先(2,4)は壁なので押せない
  assert.deepStrictEqual(tryPushBlock(map, [{ x: 2, y: 3 }], 2, 2, 'down'), { pushable: false });
});

test('tryPushBlock: 押し先に別ブロックがあれば押せない', () => {
  const map = synthMap();
  // 正面(2,2)を下へ → 押し先(2,3)に別ブロックがあるので押せない
  assert.deepStrictEqual(
    tryPushBlock(map, [{ x: 2, y: 2 }, { x: 2, y: 3 }], 2, 1, 'down'),
    { pushable: false }
  );
});

test('tryPushBlock: 押し先にワープがあれば押せない（事故転送防止）', () => {
  const map = synthMap({ warps: [{ x: 2, y: 3, tx: 1, ty: 1 }] });
  assert.deepStrictEqual(tryPushBlock(map, [{ x: 2, y: 2 }], 2, 1, 'down'), { pushable: false });
});

// ── 実マップ整合：隠しマップ secret_field が正しく存在する ──────────────
test('secret_field（隠しトレーニングルーム）が暗闇・エンカウント無しで存在', () => {
  const sf = MAPS.secret_field;
  assert.ok(sf, 'secret_field が無い');
  assert.strictEqual(sf.dark, true, 'dark:true（暗闇）でない');
  assert.ok(sf.encounter && sf.encounter.rate === 0, 'encounter.rate が 0 でない（隠し部屋は戦闘なし）');
  assert.ok(!sf.encounter.rare, 'secret_field にレア枠は不要');
});

// ── 実マップ整合：ギミック座標はすべて「踏める」タイルである ──────────────
test('全マップのワープ元/動く床/押しブロック/ゴール座標は walkable', () => {
  Object.keys(MAPS).forEach((id) => {
    const map = MAPS[id];
    const opened = {};
    (map.warps || []).forEach((w) => {
      assert.ok(isWalkable(map, w.x, w.y, opened), id + ' のワープ元(' + w.x + ',' + w.y + ')が踏めない');
    });
    (map.conveyors || []).forEach((c) => {
      assert.ok(isWalkable(map, c.x, c.y, opened), id + ' の動く床(' + c.x + ',' + c.y + ')が踏めない');
    });
    (map.pushBlocks || []).forEach((b) => {
      assert.ok(isWalkable(map, b.x, b.y, opened), id + ' の押しブロック下(' + b.x + ',' + b.y + ')が踏めない');
    });
    (map.pushGoals || []).forEach((g) => {
      assert.ok(isWalkable(map, g.x, g.y, opened), id + ' のゴール(' + g.x + ',' + g.y + ')が踏めない');
    });
  });
});

// ── 実マップ整合：ワープ先が安全（連鎖暴走しない・実在マップ） ─────────────
test('ワープ先は安全：同マップ先はワープでない／別マップ先は実在して踏める', () => {
  Object.keys(MAPS).forEach((id) => {
    const map = MAPS[id];
    (map.warps || []).forEach((w) => {
      if (w.to) {
        const dest = MAPS[w.to];
        assert.ok(dest, id + ' のワープ先マップ ' + w.to + ' が存在しない');
        assert.ok(isWalkable(dest, w.tx, w.ty, {}), id + '→' + w.to + ' の到着(' + w.tx + ',' + w.ty + ')が踏めない');
      } else {
        // 同マップテレポート：到着先がさらにワープだと無限ループの恐れ
        assert.strictEqual(
          warpAt(map, w.tx, w.ty), null,
          id + ' の同マップ到着(' + w.tx + ',' + w.ty + ')が別のワープ＝連鎖の危険'
        );
        assert.ok(isWalkable(map, w.tx, w.ty, {}), id + ' の同マップ到着(' + w.tx + ',' + w.ty + ')が踏めない');
      }
    });
  });
});

// ── 実マップ整合：押しパズルは block 数＝goal 数（解ける配置） ─────────────
test('押しパズルがあるマップは block 数と goal 数が一致する', () => {
  Object.keys(MAPS).forEach((id) => {
    const map = MAPS[id];
    if (map.pushBlocks || map.pushGoals) {
      const nb = (map.pushBlocks || []).length;
      const ng = (map.pushGoals || []).length;
      assert.ok(nb > 0 && ng > 0, id + ' の押しパズルに block か goal が無い');
      assert.strictEqual(nb, ng, id + ' の block 数(' + nb + ')と goal 数(' + ng + ')が不一致');
    }
  });
});

// ── 実マップ整合：全グリッドは 18行×16列（描画前提の固定サイズ） ──────────
test('全マップのグリッドは 18行×16列', () => {
  Object.keys(MAPS).forEach((id) => {
    const grid = MAPS[id].grid;
    assert.strictEqual(grid.length, 18, id + ' の行数が18でない: ' + grid.length);
    grid.forEach((row, r) => {
      assert.strictEqual(row.length, 16, id + ' の ' + r + '行目が16文字でない: ' + row.length);
    });
  });
});

// ── 実マップ整合：H（隠し通路）は見た目壁・歩ける（弾3からの回帰防止） ─────
test('TILE_LEGEND の H は walkable な隠し通路である', () => {
  assert.ok(TILE_LEGEND.H, 'H が未定義');
  assert.strictEqual(TILE_LEGEND.H.walkable, true, 'H が walkable でない');
});
