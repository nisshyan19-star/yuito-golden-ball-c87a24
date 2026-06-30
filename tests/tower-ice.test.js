// === tower-ice.test.js（Phase7-④：こおりの とう tower_ice_1f〜3f の仕様） ===
//   ・3フロアの 多層ダンジョン。氷タイル I/X を使い ambient:'snow'（明るい吹雪）
//   ・各フロアは矩形で 標準サイズ(18行×16列)
//   ・全タイルが TILE_LEGEND にある（I=氷ゆか・X=氷かべ）
//   ・最上階(3f)に ボス NPC（n.boss＝アイス・ゴーレム）がいて vanishFlag を持つ
//   ・3f に ボス撃破フラグ(requireFlag=boss_ice)でロックされた おたから
//   ・各フロアに かくし通路 H で行ける ひみつの宝がある（H無しでは入れない）
//   ・各フロアに エンカウント表（rate>0・敵あり・レア枠あり）
//   ・ch2_town ↔ 1f ↔ 2f ↔ 3f が 階段で 往復つながる
//   ・到着/もどり/上り/NPC/宝箱マスは すべて歩ける地面
//   ・各フロア 到着マスから 上り階段・ボス・道中宝・ひみつ宝まで BFS でつながる
const test   = require('node:test');
const assert = require('node:assert');
const { MAPS, TILE_LEGEND } = require('../src/data/maps.js');
const { ENEMIES } = require('../src/data/enemies.js');
const { ITEMS } = require('../src/data/items.js');

const FLOORS = ['tower_ice_1f', 'tower_ice_2f', 'tower_ice_3f'];

// この階への到着マス（他フロア/町からの exit の行き先 tx,ty）を集める。
function arrivalsInto(floorId) {
  const starts = [];
  ['ch2_town'].concat(FLOORS).forEach((src) => {
    (MAPS[src].exits || []).forEach((e) => { if (e.to === floorId) starts.push([e.tx, e.ty]); });
  });
  return starts;
}

test('氷タイル I/X が TILE_LEGEND にある（I=歩ける・X=歩けない）', () => {
  assert.ok(TILE_LEGEND.I && TILE_LEGEND.I.walkable === true, 'I（氷ゆか）が walkable でない');
  assert.ok(TILE_LEGEND.X && TILE_LEGEND.X.walkable === false, 'X（氷かべ）が walkable でない');
});

FLOORS.forEach((id) => {
  const F = () => MAPS[id];

  test(id + ' が存在し name を持つ', () => {
    assert.ok(MAPS[id], id + ' が無い');
    assert.ok(MAPS[id].name, id + '.name が無い');
  });

  test(id + ' は ambient:"snow"（吹雪）', () => {
    assert.strictEqual(F().ambient, 'snow');
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

  test(id + ' は 氷タイル I/X を使う', () => {
    const all = F().grid.join('');
    assert.ok(all.includes('I'), '氷ゆか I が無い');
    assert.ok(all.includes('X'), '氷かべ X が無い');
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
    // H を壁扱い（'I' のみ歩ける）にして BFS → ひみつ宝に届かない＝ちゃんと隠れている。
    const walkNoH = (x, y) => x >= 0 && y >= 0 && x < W && y < Hh && g[y][x] === 'I';
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

test('tower_ice_3f に ボス NPC（アイス・ゴーレム）がいて 撃破フラグを持つ', () => {
  const m = MAPS.tower_ice_3f;
  const boss = (m.npcs || []).find((n) => n.boss);
  assert.ok(boss, 'ボス NPC が無い');
  assert.ok(boss.boss.enemies && boss.boss.enemies.length, 'boss.enemies が無い');
  assert.ok(boss.boss.vanishFlag, 'boss.vanishFlag が無い（撃破後に消えない）');
  boss.boss.enemies.forEach((eid) => assert.ok(ENEMIES[eid], 'ボスの敵 ' + eid + ' が ENEMIES に無い'));
  // ボス報酬アイテムも実在する
  if (boss.boss.reward) assert.ok(ITEMS[boss.boss.reward.item], 'ボス報酬 ' + boss.boss.reward.item + ' が ITEMS に無い');
});

test('tower_ice_3f に ボス撃破でロック解除される おたからがある', () => {
  const m = MAPS.tower_ice_3f;
  const chests = m.chests || [];
  assert.ok(chests.length >= 2, '宝箱が2つ未満: ' + chests.length);
  const boss = (m.npcs || []).find((n) => n.boss);
  const locked = chests.find((c) => c.requireFlag);
  assert.ok(locked, 'requireFlag でロックされた宝箱が無い');
  assert.strictEqual(locked.requireFlag, boss.boss.vanishFlag, 'ロック宝箱の鍵がボス撃破フラグと一致しない');
  assert.ok(locked.lockedMsg, 'ロック宝箱に lockedMsg が無い');
});

test('ch2_town ↔ こおりの とう が 階段で 往復つながる', () => {
  // 町 → 1F
  const townExit = (MAPS.ch2_town.exits || []).find((e) => e.to === 'tower_ice_1f');
  assert.ok(townExit, 'ch2_town→tower_ice_1f の入口が無い');
  // 1F → 町（もどり）
  const f1back = (MAPS.tower_ice_1f.exits || []).find((e) => e.to === 'ch2_town');
  assert.ok(f1back, 'tower_ice_1f→ch2_town の もどり口が無い');
  // 1F ⇆ 2F
  const up1 = (MAPS.tower_ice_1f.exits || []).find((e) => e.to === 'tower_ice_2f');
  const back2 = (MAPS.tower_ice_2f.exits || []).find((e) => e.to === 'tower_ice_1f');
  assert.ok(up1 && back2, '1F⇆2F の階段が片方向');
  // 2F ⇆ 3F
  const up2 = (MAPS.tower_ice_2f.exits || []).find((e) => e.to === 'tower_ice_3f');
  const back3 = (MAPS.tower_ice_3f.exits || []).find((e) => e.to === 'tower_ice_2f');
  assert.ok(up2 && back3, '2F⇆3F の階段が片方向');
});

test('こおりの とう 階段の 行き先マスは すべて歩ける地面', () => {
  const walkOn = (mapId, x, y) => {
    const g = MAPS[mapId].grid;
    return !!(g[y] && TILE_LEGEND[g[y][x]] && TILE_LEGEND[g[y][x]].walkable);
  };
  const exits = [];
  (MAPS.ch2_town.exits || []).filter((e) => e.to === 'tower_ice_1f').forEach((e) => exits.push(['ch2_town', e]));
  FLOORS.forEach((fid) => (MAPS[fid].exits || []).forEach((e) => exits.push([fid, e])));
  exits.forEach(([src, e]) => {
    assert.ok(walkOn(e.to, e.tx, e.ty), src + '→' + e.to + ' の到着(' + e.tx + ',' + e.ty + ')が歩けない');
  });
});
