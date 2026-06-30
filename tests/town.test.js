// === town.test.js（弾2：町・サブクエスト・宿屋） ===
const test   = require('node:test');
const assert = require('node:assert');
const { questStage, grantReward } = require('../src/data/story.js');
const { healParty } = require('../src/logic/items-effect.js');
const { MAPS, TILE_LEGEND } = require('../src/data/maps.js');

// ── questStage：3段フラグの遷移 ───────────────────────────────────────
const Q = { acceptFlag: 'a', itemFlag: 'i', doneFlag: 'd' };

test('questStage: 未受注は ask', () => {
  assert.strictEqual(questStage(Q, {}), 'ask');
});
test('questStage: 受注済み・品物まだは wait', () => {
  assert.strictEqual(questStage(Q, { a: true }), 'wait');
});
test('questStage: 品物入手済みは clear', () => {
  assert.strictEqual(questStage(Q, { a: true, i: true }), 'clear');
});
test('questStage: 報酬受領済みは done', () => {
  assert.strictEqual(questStage(Q, { a: true, i: true, d: true }), 'done');
});
test('questStage: quest が無ければ ask（安全側）', () => {
  assert.strictEqual(questStage(null, {}), 'ask');
});

// ── grantReward：報酬の加算 ──────────────────────────────────────────
test('grantReward: ゴールドを加算する', () => {
  const s = { gold: 10, inventory: {} };
  const msg = grantReward(s, { gold: 50 });
  assert.strictEqual(s.gold, 60);
  assert.match(msg, /50ゴールド/);
});
test('grantReward: アイテムを個数ぶん加算する', () => {
  const s = { gold: 0, inventory: { drink: 1 } };
  grantReward(s, { item: 'drink', amount: 2, label: 'スポーツドリンク' });
  assert.strictEqual(s.inventory.drink, 3);
});
test('grantReward: gold と item を同時にもらえる', () => {
  const s = { gold: 0, inventory: {} };
  const msg = grantReward(s, { gold: 80, item: 'jelly', amount: 2, label: 'スタミナゼリー' });
  assert.strictEqual(s.gold, 80);
  assert.strictEqual(s.inventory.jelly, 2);
  assert.match(msg, /ゴールド/);
  assert.match(msg, /スタミナゼリー/);
});

// ── healParty：宿屋の全回復 ──────────────────────────────────────────
test('healParty: 全員 HP/MP 全回復＋復活', () => {
  const party = [
    { hp: 1,  maxHp: 50, mp: 0,  maxMp: 10, dead: false },
    { hp: 0,  maxHp: 40, mp: 5,  maxMp: 20, dead: true  },
  ];
  const n = healParty(party);
  assert.strictEqual(n, 2);
  assert.strictEqual(party[0].hp, 50);
  assert.strictEqual(party[0].mp, 10);
  assert.strictEqual(party[1].hp, 40);
  assert.strictEqual(party[1].dead, false);
});
test('healParty: 空配列でも落ちない', () => {
  assert.strictEqual(healParty([]), 0);
  assert.strictEqual(healParty(undefined), 0);
});

// ── 町マップの整合性 ─────────────────────────────────────────────────
const TOWNS = ['town1', 'town2', 'town3'];

test('町3つが存在する', () => {
  TOWNS.forEach((id) => assert.ok(MAPS[id], id + ' が無い'));
});

test('町グリッドは全行16文字・18行', () => {
  TOWNS.forEach((id) => {
    const g = MAPS[id].grid;
    assert.strictEqual(g.length, 18, id + ' の行数');
    g.forEach((row, r) => assert.strictEqual(row.length, 16, id + ' r' + r + ' の文字数'));
  });
});

test('町は戦闘なし（encounter.rate=0）', () => {
  TOWNS.forEach((id) => assert.strictEqual(MAPS[id].encounter.rate, 0, id));
});

test('町の到着(7,2)と出口(7,16)は歩ける地面', () => {
  TOWNS.forEach((id) => {
    const g = MAPS[id].grid;
    assert.ok(TILE_LEGEND[g[2][7]].walkable, id + ' 到着');
    assert.ok(TILE_LEGEND[g[16][7]].walkable, id + ' 出口');
  });
});

test('町のNPC・宝箱マスは歩ける地面の上にある', () => {
  TOWNS.forEach((id) => {
    const m = MAPS[id], g = m.grid;
    (m.npcs || []).forEach((n) => {
      const t = TILE_LEGEND[g[n.y][n.x]];
      assert.ok(t && t.walkable, id + ' NPC(' + n.x + ',' + n.y + ') が歩けない地面');
    });
    (m.chests || []).forEach((c) => {
      const t = TILE_LEGEND[g[c.y][c.x]];
      assert.ok(t && t.walkable, id + ' 宝箱(' + c.x + ',' + c.y + ') が歩けない地面');
    });
  });
});

test('町のオブジェクトは col7（道）を塞がない', () => {
  TOWNS.forEach((id) => {
    (MAPS[id].objects || []).forEach((o) => {
      assert.notStrictEqual(o.x, 7, id + ' のオブジェクトが道(col7)を塞いでいる');
    });
  });
});

test('各町に お店・宿屋・クエスト主・受け渡し相手 がそろう', () => {
  TOWNS.forEach((id) => {
    const npcs = MAPS[id].npcs || [];
    assert.ok(npcs.some((n) => n.shop && n.shop.type === 'inn'), id + ' に宿屋');
    assert.ok(npcs.some((n) => n.shop && n.shop.type !== 'inn'), id + ' にお店');
    assert.ok(npcs.some((n) => n.quest), id + ' にクエスト主');
    assert.ok(npcs.some((n) => n.give), id + ' に受け渡し相手');
  });
});

// ── ワールド導線：field1→town1→field2→field3→town2→field4→field5→town3→field6 ──
test('出口の連結が町を挟んだ順路になっている', () => {
  const to = (id) => MAPS[id].exits.map((e) => e.to);
  assert.deepStrictEqual(to('field1'), ['town1']);
  assert.deepStrictEqual(to('town1'),  ['field2', 'village1']);
  assert.deepStrictEqual(to('field2'), ['field3']);
  assert.deepStrictEqual(to('field3'), ['town2']);
  assert.deepStrictEqual(to('town2'),  ['field4']);
  assert.deepStrictEqual(to('field4'), ['field5']);
  assert.deepStrictEqual(to('field5'), ['town3']);
  // town3 は南で field6 へ。追加弾5（第2章）で 北の とびらが 加わり、
  // boss_kaiser 撃破後に ch2_gate（やみのもん）へ つながる。
  assert.deepStrictEqual(to('town3'),  ['field6', 'ch2_gate']);
  // field6 は ストーリー上は 行き止まり。ただし 追加弾4-Dで ラスボス撃破後に
  // ひらく「ちょうせんの間」への とびらが 加わった（boss_kaiser でゲート）。
  assert.deepStrictEqual(to('field6'), ['challenge_room']);
});

test('field5→town3 の出口はガーディアン撃破フラグでロックされている', () => {
  const e = MAPS.field5.exits[0];
  assert.strictEqual(e.to, 'town3');
  assert.strictEqual(e.requireFlag, 'boss_guardian');
  assert.ok(e.lockedMsg);
});
