// === village.test.js（Phase7-②：広い村マップ village1 の仕様） ===
//   ・village1 は既存町(16×18)より広く、矩形で、全タイルが TILE_LEGEND にある
//   ・戦闘なし(encounter.rate 0)、town1 と往復でつながる
//   ・到着/出口マス・NPC/宝箱マスは歩ける地面の上
//   ・お店＋宿屋がある、井戸/畑/柵オブジェクトで豪華にする
//   ・solid オブジェクトは到着/出口マスを塞がない
const test   = require('node:test');
const assert = require('node:assert');
const { MAPS, TILE_LEGEND } = require('../src/data/maps.js');

test('village1 が存在し name を持つ', () => {
  assert.ok(MAPS.village1, 'village1 が無い');
  assert.ok(MAPS.village1.name, 'village1.name が無い');
});

test('village1 の grid は矩形で 既存町(16×18)より広い', () => {
  const g = MAPS.village1.grid;
  assert.ok(g.length >= 20, '行数が20以上(縦に広い): ' + g.length);
  const w = g[0].length;
  assert.ok(w >= 18, '列数が18以上(横に広い): ' + w);
  g.forEach((row, r) => assert.strictEqual(row.length, w, 'r' + r + ' の列数が不揃い: ' + row.length));
});

test('village1 の全タイル文字が TILE_LEGEND にある', () => {
  MAPS.village1.grid.forEach((row, r) => {
    for (const ch of row) assert.ok(TILE_LEGEND[ch], 'r' + r + ' に未知タイル "' + ch + '"');
  });
});

test('village1 は戦闘なし(encounter.rate 0)', () => {
  assert.ok(MAPS.village1.encounter, 'encounter が無い');
  assert.strictEqual(MAPS.village1.encounter.rate, 0);
});

test('village1 ↔ town1 が往復でつながる', () => {
  const vExits = (MAPS.village1.exits || []).map(e => e.to);
  assert.ok(vExits.includes('town1'), 'village1→town1 の出口が無い');
  const tExits = (MAPS.town1.exits || []).map(e => e.to);
  assert.ok(tExits.includes('village1'), 'town1→village1 の入口が無い');
});

test('village1 の到着/出口マスは歩ける', () => {
  const m = MAPS.village1, g = m.grid;
  const into = MAPS.town1.exits.find(e => e.to === 'village1');
  assert.ok(TILE_LEGEND[g[into.ty][into.tx]].walkable, '村の到着マス(' + into.tx + ',' + into.ty + ')が歩けない');
  const back = m.exits.find(e => e.to === 'town1');
  assert.ok(TILE_LEGEND[g[back.y][back.x]].walkable, '村の出口マス(' + back.x + ',' + back.y + ')が歩けない');
});

test('village1 に お店と宿屋がある', () => {
  const npcs = MAPS.village1.npcs || [];
  assert.ok(npcs.some(n => n.shop && n.shop.type === 'inn'), '宿屋(inn)が無い');
  assert.ok(npcs.some(n => n.shop && n.shop.type !== 'inn'), 'お店が無い');
});

test('village1 の NPC・宝箱は歩ける地面の上', () => {
  const m = MAPS.village1, g = m.grid;
  (m.npcs || []).forEach(n => assert.ok(TILE_LEGEND[g[n.y][n.x]].walkable, 'NPC(' + n.x + ',' + n.y + ')が歩けない'));
  (m.chests || []).forEach(c => assert.ok(TILE_LEGEND[g[c.y][c.x]].walkable, '宝箱(' + c.x + ',' + c.y + ')が歩けない'));
});

test('village1 に 井戸/畑/柵 のオブジェクトがある（豪華さ）', () => {
  const types = new Set((MAPS.village1.objects || []).map(o => o.type));
  assert.ok(types.has('well'),  '井戸(well)が無い');
  assert.ok(types.has('crop'),  '畑(crop)が無い');
  assert.ok(types.has('fence'), '柵(fence)が無い');
});

test('village1 の solid オブジェクトは到着/出口マスを塞がない', () => {
  const m = MAPS.village1;
  const into = MAPS.town1.exits.find(e => e.to === 'village1');
  const back = m.exits.find(e => e.to === 'town1');
  (m.objects || []).filter(o => o.solid).forEach(o => {
    assert.ok(!(o.x === into.tx && o.y === into.ty), '到着マスを塞ぐsolid obj(' + o.x + ',' + o.y + ')');
    assert.ok(!(o.x === back.x && o.y === back.y), '出口マスを塞ぐsolid obj(' + o.x + ',' + o.y + ')');
  });
});
