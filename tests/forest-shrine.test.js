// === forest-shrine.test.js（Phase7-⑤：もりの しんでん shrine_forest_1f〜3f の仕様） ===
//   ・3フロアの 多層ダンジョン。苔/つるタイル M/V を使い ambient:'forest'（こもれび）
//   ・各フロアは矩形で 標準サイズ(18行×16列)
//   ・全タイルが TILE_LEGEND にある（M=苔ゆか・V=つるかべ）
//   ・最上階(3f)に ボス NPC（森の守り神 ガイア）がいて vanishFlag を持つ
//   ・3f に ボス撃破フラグ(requireFlag=boss_forest)でロックされた おたから
//   ・各フロアに かくし通路 H で行ける ひみつの宝がある（H無しでは入れない）
//   ・各フロアに エンカウント表（rate>0・敵あり・レア枠あり）
//   ・ch2_pass → 1f ⇆ 2f ⇆ 3f → ch2_castle が 階段で つながる（本線に組み込み）
//   ・到着/もどり/上り/NPC/宝箱マスは すべて歩ける地面
//   ・各フロア 到着マスから 上り階段・ボス・道中宝・ひみつ宝まで BFS でつながる
const test   = require('node:test');
const assert = require('node:assert');
const { MAPS, TILE_LEGEND } = require('../src/data/maps.js');
const { ENEMIES } = require('../src/data/enemies.js');
const { ITEMS } = require('../src/data/items.js');
const { objectiveFor } = require('../src/data/story.js');

const FLOORS = ['shrine_forest_1f', 'shrine_forest_2f', 'shrine_forest_3f'];
// 森の神殿への 外部からの入口（本線：ch2_pass から 1F へ／ch2_castle から 3F へ戻る）
const EXTERNAL = ['ch2_pass', 'ch2_castle'];

// この階への到着マス（他フロア/本線マップからの exit の行き先 tx,ty）を集める。
function arrivalsInto(floorId) {
  const starts = [];
  EXTERNAL.concat(FLOORS).forEach((src) => {
    (MAPS[src].exits || []).forEach((e) => { if (e.to === floorId) starts.push([e.tx, e.ty]); });
  });
  return starts;
}

test('苔/つるタイル M/V が TILE_LEGEND にある（M=歩ける・V=歩けない）', () => {
  assert.ok(TILE_LEGEND.M && TILE_LEGEND.M.walkable === true, 'M（苔ゆか）が walkable でない');
  assert.ok(TILE_LEGEND.V && TILE_LEGEND.V.walkable === false, 'V（つるかべ）が walkable でない');
});

FLOORS.forEach((id) => {
  const F = () => MAPS[id];

  test(id + ' が存在し name を持つ', () => {
    assert.ok(MAPS[id], id + ' が無い');
    assert.ok(MAPS[id].name, id + '.name が無い');
  });

  test(id + ' は ambient:"forest"（こもれび）', () => {
    assert.strictEqual(F().ambient, 'forest');
  });

  test(id + ' の grid は矩形で 標準18行×16列', () => {
    const g = F().grid;
    assert.strictEqual(g.length, 18, '行数が18でない: ' + g.length);
    g.forEach((row, r) => assert.strictEqual(row.length, 16, 'r' + r + ' の列数が16でない: ' + row.length));
  });

  test(id + ' の全タイル文字が TILE_LEGEND にある', () => {
    F().grid.forEach((row, r) => {
      for (const ch of row) assert.ok(TILE_LEGEND[ch], 'r' + r + ' に未知タイル "' + ch + '"');
    });
  });

  test(id + ' は 苔/つるタイル M/V を使う', () => {
    const all = F().grid.join('');
    assert.ok(all.includes('M'), '苔ゆか M が無い');
    assert.ok(all.includes('V'), 'つるかべ V が無い');
  });

  test(id + ' に かくし通路 H がある（探索）', () => {
    assert.ok(F().grid.join('').includes('H'), 'かくし通路 H が無い');
  });

  test(id + ' の エンカウント表は rate>0・敵あり・レア枠あり', () => {
    const e = F().encounter;
    assert.ok(e && e.rate > 0, 'encounter.rate が 0 以下');
    assert.ok(e.enemies && e.enemies.length, 'encounter.enemies が無い');
    e.enemies.forEach((eid) => assert.ok(ENEMIES[eid], 'ザコ ' + eid + ' が ENEMIES に無い'));
    assert.ok(e.rare && e.rare.enemies && e.rare.enemies.length, 'レア枠 rare が無い');
    e.rare.enemies.forEach((eid) => assert.ok(ENEMIES[eid], 'レア ' + eid + ' が ENEMIES に無い'));
  });

  test(id + ' の 宝箱アイテムは ITEMS に実在する', () => {
    (F().chests || []).forEach((c) => assert.ok(ITEMS[c.item], '宝箱の item ' + c.item + ' が ITEMS に無い'));
  });

  test(id + ' の NPC/宝箱マスは すべて歩ける地面', () => {
    const g = F().grid;
    const walk = (x, y) => TILE_LEGEND[g[y][x]] && TILE_LEGEND[g[y][x]].walkable;
    (F().npcs || []).forEach((n) => assert.ok(walk(n.x, n.y), 'NPC(' + n.x + ',' + n.y + ')が歩けない'));
    (F().chests || []).forEach((c) => assert.ok(walk(c.x, c.y), '宝箱(' + c.x + ',' + c.y + ')が歩けない'));
  });

  test(id + ' は 到着マスから 上り階段・ボス・道中宝・ひみつ宝まで つながる（BFS）', () => {
    const m = MAPS[id], g = m.grid;
    const H = g.length, W = g[0].length;
    const walk = (x, y) => x >= 0 && y >= 0 && x < W && y < H && TILE_LEGEND[g[y][x]] && TILE_LEGEND[g[y][x]].walkable;
    const starts = arrivalsInto(id);
    assert.ok(starts.length, id + ' への到着マスが無い');
    const solid = new Set((m.objects || []).filter((o) => o.solid).map((o) => o.x + ',' + o.y));
    const seen = new Set(starts.map((s) => s[0] + ',' + s[1]));
    const q = starts.slice();
    while (q.length) {
      const [x, y] = q.shift();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (!seen.has(k) && walk(nx, ny) && !solid.has(k)) { seen.add(k); q.push([nx, ny]); }
      });
    }
    // 上り階段（より上のフロアへ向かう exit）
    (m.exits || []).filter((e) => FLOORS.indexOf(e.to) > FLOORS.indexOf(id)).forEach((e) => {
      assert.ok(seen.has(e.x + ',' + e.y), id + ' の到着から 上り階段(' + e.x + ',' + e.y + ')へ行けない');
    });
    // ボス（最上階のみ）
    const boss = (m.npcs || []).find((n) => n.boss);
    if (boss) assert.ok(seen.has(boss.x + ',' + boss.y), id + ' の到着から ボス(' + boss.x + ',' + boss.y + ')へ行けない');
    // requireFlag でない宝箱（道中宝・ひみつ宝）
    (m.chests || []).filter((c) => !c.requireFlag).forEach((c) => {
      assert.ok(seen.has(c.x + ',' + c.y), id + ' の到着から 宝箱(' + c.x + ',' + c.y + ')へ行けない');
    });
  });

  test(id + ' の ひみつ宝は H（かくし通路）でしか入れない', () => {
    const m = MAPS[id], g = m.grid;
    const W = g[0].length, Hh = g.length;
    const hidden = (m.chests || []).find((c) => /hidden/.test(c.id));
    assert.ok(hidden, id + ' に ひみつ宝（id に hidden）が無い');
    // H を壁扱い（'M' のみ歩ける）にして BFS → ひみつ宝に届かない＝ちゃんと隠れている。
    const walkNoH = (x, y) => x >= 0 && y >= 0 && x < W && y < Hh && g[y][x] === 'M';
    const starts = arrivalsInto(id);
    const seen = new Set(starts.map((s) => s[0] + ',' + s[1]));
    const q = starts.slice();
    while (q.length) {
      const [x, y] = q.shift();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (!seen.has(k) && walkNoH(nx, ny)) { seen.add(k); q.push([nx, ny]); }
      });
    }
    assert.ok(!seen.has(hidden.x + ',' + hidden.y),
      id + ' の ひみつ宝(' + hidden.x + ',' + hidden.y + ') が H 無しで入れてしまう＝隠しになってない');
  });
});

test('shrine_forest_3f に ボス NPC（森の守り神 ガイア）がいて 撃破フラグを持つ', () => {
  const m = MAPS.shrine_forest_3f;
  const boss = (m.npcs || []).find((n) => n.boss);
  assert.ok(boss, 'ボス NPC が無い');
  assert.ok(boss.boss.enemies && boss.boss.enemies.length, 'boss.enemies が無い');
  assert.deepStrictEqual(boss.boss.enemies, ['forest_guardian'], 'ボスの敵が forest_guardian でない');
  assert.strictEqual(boss.boss.vanishFlag, 'boss_forest', 'boss.vanishFlag が boss_forest でない');
  assert.strictEqual(boss.boss.winFlag, 'boss_forest', 'boss.winFlag が boss_forest でない');
  boss.boss.enemies.forEach((eid) => assert.ok(ENEMIES[eid], 'ボスの敵 ' + eid + ' が ENEMIES に無い'));
  // ボス報酬アイテム（こもれびの つるぎ）も実在する
  assert.ok(boss.boss.reward, 'boss.reward が無い');
  assert.strictEqual(boss.boss.reward.item, 'leaf_blade', 'ボス報酬が leaf_blade でない');
  assert.ok(ITEMS[boss.boss.reward.item], 'ボス報酬 ' + boss.boss.reward.item + ' が ITEMS に無い');
});

test('shrine_forest_3f に ボス撃破でロック解除される おたからがある', () => {
  const m = MAPS.shrine_forest_3f;
  const chests = m.chests || [];
  assert.ok(chests.length >= 2, '宝箱が2つ未満: ' + chests.length);
  const boss = (m.npcs || []).find((n) => n.boss);
  const locked = chests.find((c) => c.requireFlag);
  assert.ok(locked, 'requireFlag でロックされた宝箱が無い');
  assert.strictEqual(locked.requireFlag, boss.boss.vanishFlag, 'ロック宝箱の鍵がボス撃破フラグと一致しない');
  assert.ok(locked.lockedMsg, 'ロック宝箱に lockedMsg が無い');
  assert.ok(ITEMS[locked.item], 'ロック宝箱の item ' + locked.item + ' が ITEMS に無い');
});

test('shrine_forest_3f → ch2_castle の北の扉は requireFlag:boss_forest でロック', () => {
  const exits = MAPS.shrine_forest_3f.exits || [];
  const gate = exits.find((e) => e.to === 'ch2_castle');
  assert.ok(gate, 'ch2_castle への扉が無い');
  assert.strictEqual(gate.requireFlag, 'boss_forest', '北の扉が boss_forest でロックされていない');
  assert.ok(gate.lockedMsg, '北の扉に lockedMsg が無い');
});

test('ch2_pass → もりの しんでん → ch2_castle が 階段で つながる（本線）', () => {
  // ch2_pass → 1F（氷の塔クリアで開く）
  const passExit = (MAPS.ch2_pass.exits || []).find((e) => e.to === 'shrine_forest_1f');
  assert.ok(passExit, 'ch2_pass→shrine_forest_1f の入口が無い');
  assert.strictEqual(passExit.requireFlag, 'boss_ice', 'ch2_pass→1F の鍵が boss_ice でない');
  // 1F → ch2_pass（もどり）
  const f1back = (MAPS.shrine_forest_1f.exits || []).find((e) => e.to === 'ch2_pass');
  assert.ok(f1back, 'shrine_forest_1f→ch2_pass の もどり口が無い');
  // 1F ⇆ 2F
  const up1 = (MAPS.shrine_forest_1f.exits || []).find((e) => e.to === 'shrine_forest_2f');
  const back2 = (MAPS.shrine_forest_2f.exits || []).find((e) => e.to === 'shrine_forest_1f');
  assert.ok(up1 && back2, '1F⇆2F の階段が片方向');
  // 2F ⇆ 3F
  const up2 = (MAPS.shrine_forest_2f.exits || []).find((e) => e.to === 'shrine_forest_3f');
  const back3 = (MAPS.shrine_forest_3f.exits || []).find((e) => e.to === 'shrine_forest_2f');
  assert.ok(up2 && back3, '2F⇆3F の階段が片方向');
  // 3F → ch2_castle ／ ch2_castle → 3F（往復）
  const toCastle = (MAPS.shrine_forest_3f.exits || []).find((e) => e.to === 'ch2_castle');
  const castleBack = (MAPS.ch2_castle.exits || []).find((e) => e.to === 'shrine_forest_3f');
  assert.ok(toCastle && castleBack, '3F⇆ch2_castle が片方向');
});

test('もりの しんでん 階段の 行き先マスは すべて歩ける地面', () => {
  const walkOn = (mapId, x, y) => {
    const g = MAPS[mapId].grid;
    return !!(g[y] && TILE_LEGEND[g[y][x]] && TILE_LEGEND[g[y][x]].walkable);
  };
  const exits = [];
  (MAPS.ch2_pass.exits || []).filter((e) => e.to === 'shrine_forest_1f').forEach((e) => exits.push(['ch2_pass', e]));
  (MAPS.ch2_castle.exits || []).filter((e) => e.to === 'shrine_forest_3f').forEach((e) => exits.push(['ch2_castle', e]));
  FLOORS.forEach((fid) => (MAPS[fid].exits || []).forEach((e) => exits.push([fid, e])));
  exits.forEach(([src, e]) => {
    assert.ok(walkOn(e.to, e.tx, e.ty), src + '→' + e.to + ' の到着(' + e.tx + ',' + e.ty + ')が歩けない');
  });
});

// ── 森の敵5体・たから2種が データに実在する ─────────────────────────
test('森の敵5体が ENEMIES に存在する', () => {
  ['moss_golem', 'forest_crow', 'thorn_goblin', 'emerald_deer', 'forest_guardian'].forEach((id) => {
    assert.ok(ENEMIES[id], id + ' が ENEMIES に無い');
  });
});

test('森のたから（こもれびの つるぎ／はがねの きのよろい）が ITEMS に存在する', () => {
  ['leaf_blade', 'bark_mail'].forEach((id) => {
    assert.ok(ITEMS[id], id + ' が ITEMS に無い');
  });
});

// ── 進行ナビ：氷の塔クリア後・森未クリアなら「もりの しんでんへ！」 ──
// 仲間4人 加入済み前提（新 spine では加入目標が先頭に入るため）
const J = { joined_ikuma: true, joined_aoshi: true, joined_tomoki: true, joined_itsuki: true };

test('objectiveFor: boss_ice 済み・boss_forest 未なら もくひょうは「もりの しんでんへ！」', () => {
  const flags = Object.assign({}, J, {
    secret_puzzle: true, boss_water: true, boss_emperor: true, challenge_clear: true,
    boss_magma: true, boss_guardian: true, boss_kaiser: true,
    boss_dark_general: true, boss_ice: true,
  });
  const obj = objectiveFor(flags);
  assert.strictEqual(obj.bar, 'もりの しんでんへ！');
  assert.strictEqual(obj.done, false);
});

test('objectiveFor: boss_forest も済むと つぎは「やみのしろへ！」', () => {
  const flags = Object.assign({}, J, {
    secret_puzzle: true, boss_water: true, boss_emperor: true, challenge_clear: true,
    boss_magma: true, boss_guardian: true, boss_kaiser: true,
    boss_dark_general: true, boss_ice: true, boss_forest: true,
  });
  const obj = objectiveFor(flags);
  assert.strictEqual(obj.bar, 'やみのしろへ！');
});
