// === water-cave.test.js（Phase7-⑥：みずの どうくつ cave_water_1f〜3f の仕様） ===
//   ・town2 から いける 任意の 多層ダンジョン（本線スパインには つながない 寄り道）
//   ・3フロアの 矩形 標準サイズ(18行×16列)・ambient:'rain'（青い減光＋しずく）
//   ・洞窟タイル c/C と あさせ a・ふかい水 ~・はし b・かくし通路 H を使う
//   ・全タイルが TILE_LEGEND にある
//   ・最上階(3f)に ボス NPC（n.boss＝アクア・ゴーレム）がいて vanishFlag を持つ
//   ・3f に ボス撃破フラグ(requireFlag=boss_water)でロックされた おたから
//   ・各フロアに かくし通路 H でしか入れない ひみつの宝がある
//   ・各フロアに エンカウント表（rate>0・敵あり・レア枠あり）
//   ・town2 ↔ 1f ↔ 2f ↔ 3f が 階段で 往復つながる
//   ・到着/もどり/上り/NPC/宝箱マスは すべて歩ける地面
//   ・各フロア 到着マスから 上り階段・ボス・道中宝・ひみつ宝まで BFS でつながる
const test   = require('node:test');
const assert = require('node:assert');
const { MAPS, TILE_LEGEND } = require('../src/data/maps.js');
const { ENEMIES } = require('../src/data/enemies.js');
const { ITEMS } = require('../src/data/items.js');

const FLOORS = ['cave_water_1f', 'cave_water_2f', 'cave_water_3f'];

// この階への到着マス（他フロア/町からの exit の行き先 tx,ty）を集める。
function arrivalsInto(floorId) {
  const starts = [];
  ['town2'].concat(FLOORS).forEach((src) => {
    (MAPS[src].exits || []).forEach((e) => { if (e.to === floorId) starts.push([e.tx, e.ty]); });
  });
  return starts;
}

test('みずタイル a/~/b が TILE_LEGEND にある（a=浅瀬は歩ける・~=深水は通れない・b=橋は歩ける）', () => {
  assert.ok(TILE_LEGEND.a && TILE_LEGEND.a.walkable === true, 'a（あさせ）が walkable でない');
  assert.ok(TILE_LEGEND['~'] && TILE_LEGEND['~'].walkable === false, '~（ふかい水）が歩けてしまう');
  assert.ok(TILE_LEGEND.b && TILE_LEGEND.b.walkable === true, 'b（はし）が walkable でない');
});

FLOORS.forEach((id) => {
  const F = () => MAPS[id];

  test(id + ' が存在し name を持つ', () => {
    assert.ok(MAPS[id], id + ' が無い');
    assert.ok(MAPS[id].name, id + '.name が無い');
  });

  test(id + ' は ambient:"rain"（あめ・しずく）', () => {
    assert.strictEqual(F().ambient, 'rain');
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

  test(id + ' は あさせ a と ふかい水 ~ を使う', () => {
    const all = F().grid.join('');
    assert.ok(all.includes('a'), 'あさせ a が無い');
    assert.ok(all.includes('~'), 'ふかい水 ~ が無い');
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
    // H を壁扱い（H 以外の歩けるタイルだけ通れる）にして BFS → ひみつ宝に届かない＝ちゃんと隠れている。
    const walkNoH = (x, y) =>
      x >= 0 && y >= 0 && x < W && y < Hh &&
      g[y][x] !== 'H' && TILE_LEGEND[g[y][x]] && TILE_LEGEND[g[y][x]].walkable;
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

test('cave_water_3f に ボス NPC（アクア・ゴーレム）がいて 撃破フラグを持つ', () => {
  const m = MAPS.cave_water_3f;
  const boss = (m.npcs || []).find((n) => n.boss);
  assert.ok(boss, 'ボス NPC が無い');
  assert.ok(boss.boss.enemies && boss.boss.enemies.length, 'boss.enemies が無い');
  assert.ok(boss.boss.vanishFlag, 'boss.vanishFlag が無い（撃破後に消えない）');
  boss.boss.enemies.forEach((eid) => assert.ok(ENEMIES[eid], 'ボスの敵 ' + eid + ' が ENEMIES に無い'));
  if (boss.boss.reward) assert.ok(ITEMS[boss.boss.reward.item], 'ボス報酬 ' + boss.boss.reward.item + ' が ITEMS に無い');
});

test('cave_water_3f に ボス撃破でロック解除される おたからがある', () => {
  const m = MAPS.cave_water_3f;
  const chests = m.chests || [];
  assert.ok(chests.length >= 2, '宝箱が2つ未満: ' + chests.length);
  const boss = (m.npcs || []).find((n) => n.boss);
  const locked = chests.find((c) => c.requireFlag);
  assert.ok(locked, 'requireFlag でロックされた宝箱が無い');
  assert.strictEqual(locked.requireFlag, boss.boss.vanishFlag, 'ロック宝箱の鍵がボス撃破フラグと一致しない');
  assert.ok(locked.lockedMsg, 'ロック宝箱に lockedMsg が無い');
});

test('town2 ↔ みずの どうくつ が 階段で 往復つながる', () => {
  // 町 → 1F
  const townExit = (MAPS.town2.exits || []).find((e) => e.to === 'cave_water_1f');
  assert.ok(townExit, 'town2→cave_water_1f の入口が無い');
  // 1F → 町（もどり）
  const f1back = (MAPS.cave_water_1f.exits || []).find((e) => e.to === 'town2');
  assert.ok(f1back, 'cave_water_1f→town2 の もどり口が無い');
  // 1F ⇆ 2F
  const up1 = (MAPS.cave_water_1f.exits || []).find((e) => e.to === 'cave_water_2f');
  const back2 = (MAPS.cave_water_2f.exits || []).find((e) => e.to === 'cave_water_1f');
  assert.ok(up1 && back2, '1F⇆2F の階段が片方向');
  // 2F ⇆ 3F
  const up2 = (MAPS.cave_water_2f.exits || []).find((e) => e.to === 'cave_water_3f');
  const back3 = (MAPS.cave_water_3f.exits || []).find((e) => e.to === 'cave_water_2f');
  assert.ok(up2 && back3, '2F⇆3F の階段が片方向');
});

test('みずの どうくつ 階段の 行き先マスは すべて歩ける地面', () => {
  const walkOn = (mapId, x, y) => {
    const g = MAPS[mapId].grid;
    return !!(g[y] && TILE_LEGEND[g[y][x]] && TILE_LEGEND[g[y][x]].walkable);
  };
  const exits = [];
  (MAPS.town2.exits || []).filter((e) => e.to === 'cave_water_1f').forEach((e) => exits.push(['town2', e]));
  FLOORS.forEach((fid) => (MAPS[fid].exits || []).forEach((e) => exits.push([fid, e])));
  exits.forEach(([src, e]) => {
    assert.ok(walkOn(e.to, e.tx, e.ty), src + '→' + e.to + ' の到着(' + e.tx + ',' + e.ty + ')が歩けない');
  });
});

test('みずの どうくつ は 本線スパイン（7ボス）に つながない＝寄り道専用', () => {
  // 本線マップ（field/town/ch2/challenge/shrine/tower/village/cave1 など）から
  // cave_water_* へ向かう exit は town2 の 1本だけ（任意ダンジョンの入口）に限る。
  const intoWater = [];
  Object.keys(MAPS).forEach((mid) => {
    if (FLOORS.indexOf(mid) >= 0) return; // 水洞窟内部の階段は除外
    (MAPS[mid].exits || []).forEach((e) => {
      if (FLOORS.indexOf(e.to) >= 0) intoWater.push(mid + '→' + e.to);
    });
  });
  assert.deepStrictEqual(intoWater, ['town2→cave_water_1f'],
    '水洞窟への入口が town2 以外にもある（本線に混ざっている）: ' + JSON.stringify(intoWater));
});
