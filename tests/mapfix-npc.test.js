// === mapfix-npc.test.js（サブC：NPC拡充＝加入前カメオ＋新NPC種） ===
const { test } = require('node:test');
const assert = require('node:assert');
const { MAPS, TILE_LEGEND } = require('../src/data/maps.js');
const { SPRITES } = require('../src/data/sprites.js');

function isWalkable(map, x, y) {
  const row = map && map.grid && map.grid[y];
  if (!row || x < 0 || x >= row.length) return false;
  const t = TILE_LEGEND[row[x]];
  return !!(t && t.walkable);
}
// 指定マップの (x,y) に、既存の別 npc / solid object / exit が無いこと
function isFree(map, x, y, exceptNpc) {
  const npcHit = (map.npcs || []).some(n => n !== exceptNpc && n.x === x && n.y === y);
  const objHit = (map.objects || []).some(o => o.x === x && o.y === y && o.solid);
  const exitHit = (map.exits || []).some(e => e.x === x && e.y === y);
  return !npcHit && !objHit && !exitHit;
}
function npcAt(mapId, x, y) {
  return (MAPS[mapId].npcs || []).find(n => n.x === x && n.y === y);
}

const NEW_SPRITE_KEYS = [
  'girl_pink', 'boy_blue', 'granny', 'grandpa', 'woman_brown',
  'young_man', 'referee', 'reporter', 'vendor', 'supporter',
];

test('sprites.js に新NPCスプライト10種が生成されている', () => {
  for (const key of NEW_SPRITE_KEYS) {
    assert.ok(SPRITES[key], `SPRITES.${key} が無い`);
  }
});

// ── C2: 加入前カメオ（仲間スプライトのまま手前マップに立つ・joinId無し）──
const CAMEOS = [
  ['town1',  9,  7, 'aoshi',  'joined_aoshi'],
  ['field2', 13, 7, 'tomoki', 'joined_tomoki'],
  ['field3', 12, 7, 'itsuki', 'joined_itsuki'],
];

for (const [mapId, x, y, sprite, vanishFlag] of CAMEOS) {
  test(`カメオ: ${mapId} (${x},${y}) に ${sprite}（vanishFlag=${vanishFlag}, joinId無し）`, () => {
    const map = MAPS[mapId];
    const n = npcAt(mapId, x, y);
    assert.ok(n, `${mapId}(${x},${y}) にカメオNPCが無い`);
    assert.strictEqual(n.sprite, sprite);
    assert.strictEqual(n.vanishFlag, vanishFlag);
    assert.strictEqual(n.joinId, undefined, 'カメオに joinId を付けない');
    assert.ok(Array.isArray(n.pages) && n.pages.length > 0);
    assert.ok(isWalkable(map, x, y), `(${x},${y}) が歩行不可`);
    assert.ok(isFree(map, x, y, n), `(${x},${y}) が他要素と重複`);
  });
}

// ── C3: 各町に新NPC種を配置（会話のみ・joinId無し）──
const TOWN_NPCS = [
  ['town1', 5, 7, 'girl_pink'],
  ['town1', 9, 10, 'grandpa'],
  ['town1', 12, 15, 'vendor'],
  ['town2', 6, 6, 'woman_brown'],
  ['town2', 13, 9, 'boy_blue'],
  ['town2', 2, 15, 'supporter'],
  ['town3', 1, 8, 'reporter'],
  ['town3', 13, 10, 'granny'],
  ['village1', 16, 6, 'grandpa'],
  ['village1', 8, 12, 'girl_pink'],
];

for (const [mapId, x, y, sprite] of TOWN_NPCS) {
  test(`町NPC: ${mapId} (${x},${y}) に ${sprite}`, () => {
    const map = MAPS[mapId];
    const n = npcAt(mapId, x, y);
    assert.ok(n, `${mapId}(${x},${y}) にNPCが無い`);
    assert.strictEqual(n.sprite, sprite);
    assert.ok(Array.isArray(n.pages) && n.pages.length > 0);
    assert.strictEqual(n.joinId, undefined);
    assert.ok(isWalkable(map, x, y), `(${x},${y}) が歩行不可`);
    assert.ok(isFree(map, x, y, n), `(${x},${y}) が他要素と重複`);
  });
}

// ── C4: 各フィールドに新NPC種を配置（会話のみ・joinId無し・boss無し）──
const FIELD_NPCS = [
  ['field1', 11, 11, 'boy_blue'],
  ['field2', 2, 7, 'supporter'],
  ['field3', 2, 7, 'woman_brown'],
  ['field4', 13, 6, 'granny'],
  ['field5', 2, 7, 'reporter'],
  ['field6', 2, 5, 'young_man'],
];

for (const [mapId, x, y, sprite] of FIELD_NPCS) {
  test(`フィールドNPC: ${mapId} (${x},${y}) に ${sprite}`, () => {
    const map = MAPS[mapId];
    const n = npcAt(mapId, x, y);
    assert.ok(n, `${mapId}(${x},${y}) にNPCが無い`);
    assert.strictEqual(n.sprite, sprite);
    assert.ok(Array.isArray(n.pages) && n.pages.length > 0);
    assert.strictEqual(n.joinId, undefined);
    assert.strictEqual(n.boss, undefined, 'フィールドNPCはボスにしない');
    assert.ok(isWalkable(map, x, y), `(${x},${y}) が歩行不可`);
    assert.ok(isFree(map, x, y, n), `(${x},${y}) が他要素と重複`);
  });
}

// ── 審判(referee)を試合会場（世界大会スタジアム）に1体配置 ──
test('審判: wc_stadium (11,15) に referee（会話のみ・joinId無し・boss無し）', () => {
  const mapId = 'wc_stadium', x = 11, y = 15;
  const map = MAPS[mapId];
  const n = npcAt(mapId, x, y);
  assert.ok(n, `${mapId}(${x},${y}) に審判NPCが無い`);
  assert.strictEqual(n.sprite, 'referee');
  assert.ok(Array.isArray(n.pages) && n.pages.length > 0);
  assert.strictEqual(n.joinId, undefined);
  assert.strictEqual(n.boss, undefined, '審判はボスにしない');
  assert.ok(isWalkable(map, x, y), `(${x},${y}) が歩行不可`);
  assert.ok(isFree(map, x, y, n), `(${x},${y}) が他要素と重複`);
});
