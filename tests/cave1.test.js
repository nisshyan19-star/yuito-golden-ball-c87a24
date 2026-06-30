// === cave1.test.js（Phase7-③：ほのおの どうくつ cave1 の仕様） ===
//   ・cave1 は暗闇(dark:true)の広いダンジョン。洞窟タイル c/C/L を使う
//   ・矩形で 標準(18行×16列)より広い（探索しがいのある ダンジョン）
//   ・全タイルが TILE_LEGEND にある
//   ・ボス NPC（n.boss）がいて、撃破フラグ vanishFlag を持つ（撃破後に消える）
//   ・宝箱が複数。うち1つは ボス撃破フラグ(requireFlag)でロックされた おたから
//   ・かくし通路 H で行ける ひみつの宝がある
//   ・エンカウント表があり レア枠もある
//   ・村(village1)と 往復でつながる（村→洞窟 exit、洞窟→村 warp/exit）
//   ・到着マス・もどりマス・NPC/宝箱マスは すべて歩ける地面
//   ・入口から ボス／道中宝／ひみつ宝まで タイルで つながっている（行き止まり無し・BFS）
const test   = require('node:test');
const assert = require('node:assert');
const { MAPS, TILE_LEGEND } = require('../src/data/maps.js');
const { ENEMIES } = require('../src/data/enemies.js');

const C = () => MAPS.cave1;

test('cave1 が存在し name を持つ', () => {
  assert.ok(MAPS.cave1, 'cave1 が無い');
  assert.ok(MAPS.cave1.name, 'cave1.name が無い');
});

test('cave1 は暗闇(dark:true)', () => {
  assert.strictEqual(C().dark, true);
});

test('cave1 の grid は矩形で 標準(18行×16列)より広い', () => {
  const g = C().grid;
  assert.ok(g.length >= 18, '行数が18以上: ' + g.length);
  const w = g[0].length;
  assert.ok(w >= 16, '列数が16以上: ' + w);
  // 広いダンジョン（標準ちょうど18×16より大きい）
  assert.ok(g.length > 18 || w > 16, '標準サイズより広くない');
  g.forEach((row, r) => assert.strictEqual(row.length, w, 'r' + r + ' の列数が不揃い: ' + row.length));
});

test('cave1 の全タイル文字が TILE_LEGEND にある', () => {
  C().grid.forEach((row, r) => {
    for (const ch of row) assert.ok(TILE_LEGEND[ch], 'r' + r + ' に未知タイル "' + ch + '"');
  });
});

test('cave1 は 洞窟タイル c/C/L を使う', () => {
  const all = C().grid.join('');
  assert.ok(all.includes('c'), '洞窟ゆか c が無い');
  assert.ok(all.includes('C'), '洞窟かべ C が無い');
  assert.ok(all.includes('L'), 'ようがん L が無い');
});

test('cave1 に ボス NPC がいて 撃破フラグを持つ', () => {
  const boss = (C().npcs || []).find(n => n.boss);
  assert.ok(boss, 'ボス NPC が無い');
  assert.ok(boss.boss.enemies && boss.boss.enemies.length, 'boss.enemies が無い');
  assert.ok(boss.boss.vanishFlag, 'boss.vanishFlag が無い（撃破後に消えない）');
  // ボスの敵データが実在する
  boss.boss.enemies.forEach(id => assert.ok(ENEMIES[id], 'ボスの敵 ' + id + ' が ENEMIES に無い'));
});

test('cave1 に複数の宝箱があり、ボス撃破でロック解除される おたからがある', () => {
  const chests = C().chests || [];
  assert.ok(chests.length >= 2, '宝箱が2つ未満: ' + chests.length);
  const boss = (C().npcs || []).find(n => n.boss);
  const locked = chests.find(c => c.requireFlag);
  assert.ok(locked, 'requireFlag でロックされた宝箱が無い');
  assert.strictEqual(locked.requireFlag, boss.boss.vanishFlag, 'ロック宝箱の鍵がボス撃破フラグと一致しない');
  assert.ok(locked.lockedMsg, 'ロック宝箱に lockedMsg が無い');
});

test('cave1 に かくし通路 H がある（探索）', () => {
  assert.ok(C().grid.join('').includes('H'), 'かくし通路 H が無い');
});

test('cave1 の エンカウント表は rate>0・敵あり・レア枠あり', () => {
  const e = C().encounter;
  assert.ok(e && e.rate > 0, 'encounter.rate が 0 以下');
  assert.ok(e.enemies && e.enemies.length, 'encounter.enemies が無い');
  e.enemies.forEach(id => assert.ok(ENEMIES[id], 'ザコ ' + id + ' が ENEMIES に無い'));
  assert.ok(e.rare && e.rare.enemies && e.rare.enemies.length, 'レア枠 rare が無い');
  e.rare.enemies.forEach(id => assert.ok(ENEMIES[id], 'レア ' + id + ' が ENEMIES に無い'));
});

test('cave1 ↔ village1 が往復でつながる', () => {
  // 村 → 洞窟（exit）
  const vExits = (MAPS.village1.exits || []).map(e => e.to);
  assert.ok(vExits.includes('cave1'), 'village1→cave1 の入口が無い');
  // 洞窟 → 村（warp か exit）
  const back = [].concat(C().warps || [], C().exits || []).map(e => e.to);
  assert.ok(back.includes('village1'), 'cave1→village1 の もどり口が無い');
});

test('cave1 の 到着/もどり/NPC/宝箱マスは すべて歩ける地面', () => {
  const m = C(), g = m.grid;
  const walk = (x, y) => TILE_LEGEND[g[y][x]] && TILE_LEGEND[g[y][x]].walkable;
  // 村からの到着マス
  const into = MAPS.village1.exits.find(e => e.to === 'cave1');
  assert.ok(walk(into.tx, into.ty), '洞窟の到着マス(' + into.tx + ',' + into.ty + ')が歩けない');
  // 村へのもどりマス（warp元 か exit元）
  const back = (m.warps || []).concat(m.exits || []).find(e => e.to === 'village1');
  assert.ok(walk(back.x, back.y), 'もどりマス(' + back.x + ',' + back.y + ')が歩けない');
  (m.npcs || []).forEach(n => assert.ok(walk(n.x, n.y), 'NPC(' + n.x + ',' + n.y + ')が歩けない'));
  (m.chests || []).forEach(c => assert.ok(walk(c.x, c.y), '宝箱(' + c.x + ',' + c.y + ')が歩けない'));
});

test('cave1 は 入口から ボス・道中宝・ひみつ宝まで つながっている（BFS）', () => {
  const m = C(), g = m.grid;
  const H = g.length, W = g[0].length;
  const walk = (x, y) => x >= 0 && y >= 0 && x < W && y < H && TILE_LEGEND[g[y][x]] && TILE_LEGEND[g[y][x]].walkable;
  const into = MAPS.village1.exits.find(e => e.to === 'cave1');
  // BFS（NPCは無視＝ボスは撃破前提でタイル到達性を見る／solidオブジェクトはタイル上で遮る）
  const solid = new Set((m.objects || []).filter(o => o.solid).map(o => o.x + ',' + o.y));
  const seen = new Set([into.tx + ',' + into.ty]);
  const q = [[into.tx, into.ty]];
  while (q.length) {
    const [x, y] = q.shift();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (!seen.has(k) && walk(nx, ny) && !solid.has(k)) { seen.add(k); q.push([nx, ny]); }
    });
  }
  const boss = (m.npcs || []).find(n => n.boss);
  assert.ok(seen.has(boss.x + ',' + boss.y), '入口から ボス(' + boss.x + ',' + boss.y + ')へ行けない');
  // requireFlag でない宝箱（道中宝・ひみつ宝）は入口から到達できる
  (m.chests || []).filter(c => !c.requireFlag).forEach(c => {
    assert.ok(seen.has(c.x + ',' + c.y), '入口から 宝箱(' + c.x + ',' + c.y + ')へ行けない');
  });
});
