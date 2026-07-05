const test = require('node:test');
const assert = require('node:assert');
const { MAPS } = require('../src/data/maps.js');

test('3つの隠しマップが存在する', () => {
  assert.ok(MAPS.cave1_secret, 'cave1_secret無し');
  assert.ok(MAPS.tower_ice_secret, 'tower_ice_secret無し');
  assert.ok(MAPS.nebula_secret, 'nebula_secret無し');
});

test('親マップに隠し部屋への入口warpがある', () => {
  const has = (map, to) => (map.warps || []).some((w) => w.to === to);
  assert.ok(has(MAPS.cave1, 'cave1_secret'), 'cave1→cave1_secret warp無し');
  assert.ok(has(MAPS.tower_ice_2f, 'tower_ice_secret'), 'tower_ice_2f→tower_ice_secret warp無し');
  assert.ok(has(MAPS.nebula_f2, 'nebula_secret'), 'nebula_f2→nebula_secret warp無し');
});

test('各隠し部屋に加入NPC（joinId＋vanishFlag＋joinStory）と帰りwarpがある', () => {
  const check = (mapId, joinId, vanishFlag, backTo) => {
    const map = MAPS[mapId];
    const npc = (map.npcs || []).find((n) => n.joinId === joinId);
    assert.ok(npc, `${mapId} に joinId=${joinId} のNPC無し`);
    assert.strictEqual(npc.vanishFlag, vanishFlag);
    assert.ok(Array.isArray(npc.joinStory) && npc.joinStory.length >= 1, `${mapId} joinStory不備`);
    assert.ok((map.warps || []).some((w) => w.to === backTo), `${mapId} 帰りwarp(${backTo})無し`);
  };
  check('cave1_secret', 'mikity', 'joined_mikity', 'cave1');
  check('tower_ice_secret', 'nanaka', 'joined_nanaka', 'tower_ice_2f');
  check('nebula_secret', 'gensu', 'joined_gensu', 'nebula_f2');
});
