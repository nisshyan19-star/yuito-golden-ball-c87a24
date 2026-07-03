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
