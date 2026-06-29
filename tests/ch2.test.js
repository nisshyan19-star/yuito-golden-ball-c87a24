// === ch2.test.js（追加弾5-A/E：第2章「よみがえりし やみ」） ===
// 新敵8体・art伝播・新マップ4枚の接続/座標・第2章エンディング分岐を検証する。
const test   = require('node:test');
const assert = require('node:assert');
const { ENEMIES } = require('../src/data/enemies.js');
const { MAPS, TILE_LEGEND } = require('../src/data/maps.js');
const { getEnding } = require('../src/data/story.js');
const { spawnEnemies, spawnForced } = require('../src/scenes/battle-scene.js');

// ── 制御可能なスタブ乱数（決定的にする） ────────────────────────────
function stubRng(opts) {
  opts = opts || {};
  return {
    next:     () => (opts.next !== undefined ? opts.next : 0.5),
    rangeInt: (a, b) => (opts.count !== undefined ? opts.count : a),
    chance:   (p) => !!opts.chance,
    pick:     (arr) => arr[(opts.pickIndex !== undefined ? opts.pickIndex : 0)],
  };
}

// ── 1. enemies.js：新敵8体が存在し art と drops を持つ ────────────────
const NEW_ENEMIES = [
  'dark_soldier', 'night_raider', 'curse_wisp', 'frost_keeper',
  'shadow_beast', 'chaos_orb', 'dark_general', 'neo_kaiser',
];

test('第2章の新敵8体が ENEMIES に存在する', () => {
  NEW_ENEMIES.forEach((id) => {
    assert.ok(ENEMIES[id], id + ' が ENEMIES に無い');
  });
});

test('新敵8体は art と drops を持つ', () => {
  NEW_ENEMIES.forEach((id) => {
    const e = ENEMIES[id];
    assert.ok(typeof e.art === 'string' && e.art.length, id + ' に art が無い');
    assert.ok(Array.isArray(e.drops) && e.drops.length, id + ' に drops が無い');
  });
});

test('neo_kaiser は 3形態（phases.length===3）', () => {
  assert.strictEqual(ENEMIES.neo_kaiser.phases.length, 3);
});

test('各ボス（dark_general/neo_kaiser）は phases[0]（初期形態）を持つ', () => {
  ['dark_general', 'neo_kaiser'].forEach((id) => {
    const e = ENEMIES[id];
    assert.ok(e.isBoss, id + ' が isBoss でない');
    assert.ok(e.phases && e.phases[0], id + ' に phases[0] が無い');
  });
});

// ── 2. art 伝播：spawnForced / spawnEnemies が art をインスタンスへコピー ──
test('spawnForced: neo_kaiser インスタンスが art/phases/_phase/drops を持つ', () => {
  const insts = spawnForced(['neo_kaiser']);
  assert.strictEqual(insts.length, 1);
  const e = insts[0];
  assert.strictEqual(e.art, 'dark_kaiser_rage');
  assert.strictEqual(e.phases.length, 3);
  assert.strictEqual(e._phase, 1);
  assert.ok(Array.isArray(e.drops) && e.drops.length, 'drops が無い');
});

test('spawnEnemies: dark_soldier インスタンスが art を持つ', () => {
  const rng = stubRng({ count: 1, pickIndex: 0 });
  const insts = spawnEnemies(['dark_soldier'], rng);
  assert.strictEqual(insts.length, 1);
  assert.strictEqual(insts[0].art, ENEMIES.dark_soldier.art);
});

// ── 3. maps.js：新マップ4枚と接続/座標 ───────────────────────────────
const NEW_MAPS = ['ch2_gate', 'ch2_town', 'ch2_pass', 'ch2_castle'];

test('第2章の新マップ4枚が MAPS に存在する', () => {
  NEW_MAPS.forEach((k) => assert.ok(MAPS[k], k + ' が MAPS に無い'));
});

test('新マップの grid は18行・各16文字', () => {
  NEW_MAPS.forEach((k) => {
    const g = MAPS[k].grid;
    assert.strictEqual(g.length, 18, k + ' の grid が18行でない');
    g.forEach((row, i) => {
      assert.strictEqual(row.length, 16, k + ' の grid 行' + i + 'が16文字でない');
    });
  });
});

test('town3 の北exit(7,1)が ch2_gate へ・requireFlag:boss_kaiser', () => {
  const exits = MAPS.town3.exits || [];
  const north = exits.find((e) => e.x === 7 && e.y === 1);
  assert.ok(north, 'town3 に北exit(7,1)が無い');
  assert.strictEqual(north.to, 'ch2_gate');
  assert.strictEqual(north.requireFlag, 'boss_kaiser');
});

test('ch2_pass の北exit(7,1)は requireFlag:boss_dark_general', () => {
  const exits = MAPS.ch2_pass.exits || [];
  const north = exits.find((e) => e.x === 7 && e.y === 1);
  assert.ok(north, 'ch2_pass に北exit(7,1)が無い');
  assert.strictEqual(north.to, 'ch2_castle');
  assert.strictEqual(north.requireFlag, 'boss_dark_general');
});

test('ch2_castle のラスボスNPCが ending:true / winFlag:boss_neo_kaiser', () => {
  const npc = (MAPS.ch2_castle.npcs || []).find((n) => n.boss && n.boss.ending);
  assert.ok(npc, 'ch2_castle に ending ボスNPCが無い');
  assert.strictEqual(npc.boss.winFlag, 'boss_neo_kaiser');
  assert.deepStrictEqual(npc.boss.enemies, ['neo_kaiser']);
});

test('ch2_pass の中ボスNPCが dark_general / winFlag:boss_dark_general', () => {
  const npc = (MAPS.ch2_pass.npcs || []).find((n) => n.boss);
  assert.ok(npc, 'ch2_pass にボスNPCが無い');
  assert.deepStrictEqual(npc.boss.enemies, ['dark_general']);
  assert.strictEqual(npc.boss.winFlag, 'boss_dark_general');
});

// 各マップの到着座標(tx,ty)が壁でないこと＆縦一本道の整合性。
test('新マップの到着座標が壁(#)でない', () => {
  function tileAt(map, x, y) { return map.grid[y].charAt(x); }
  function walkable(ch) { return TILE_LEGEND[ch] && TILE_LEGEND[ch].walkable; }
  // 各マップ南exit(7,16)→前マップ(7,2)、北exit(7,1)→次マップ(7,15)
  NEW_MAPS.forEach((k) => {
    (MAPS[k].exits || []).forEach((e) => {
      const dest = MAPS[e.to];
      assert.ok(dest, k + ' の exit先 ' + e.to + ' が無い');
      const ch = tileAt(dest, e.tx, e.ty);
      assert.ok(walkable(ch), k + '→' + e.to + ' 到着(' + e.tx + ',' + e.ty + ')が歩けない: ' + ch);
    });
  });
});

// ── 4. story.js getEnding：第2章エンディング分岐 ─────────────────────
test('getEnding: boss_neo_kaiser フラグで「かんぜん クリア」を含むED', () => {
  const state = {
    party: [{ id: 'yuito', name: 'ユイト' }, { id: 'ikuma', name: 'イクマ' }],
    flags: { boss_neo_kaiser: true },
  };
  const pages = getEnding(state);
  assert.ok(pages.some((p) => p.indexOf('かんぜん クリア') >= 0), '第2章EDに「かんぜん クリア」が無い');
});

test('getEnding: フラグ無しは従来の第1章ED（おうごんの サッカーボール）', () => {
  const state = {
    party: [{ id: 'yuito', name: 'ユイト' }, { id: 'ikuma', name: 'イクマ' }],
    flags: {},
  };
  const pages = getEnding(state);
  assert.ok(pages.some((p) => p.indexOf('おうごんの') >= 0), '第1章EDの特徴文言が無い');
  assert.ok(!pages.some((p) => p.indexOf('かんぜん クリア') >= 0), 'フラグ無しなのに第2章EDが返った');
});
