'use strict';
const test = require('node:test');
const assert = require('node:assert');

const MAPS = require('../src/data/maps.js').MAPS;

// 指定 from マップ内の、指定 to への出口を、座標で一意特定して返す。
function findExitTo(mapId, toId, x, y) {
  const exits = (MAPS[mapId].exits || []).filter((e) => e.to === toId);
  if (typeof x === 'number' && typeof y === 'number') {
    return exits.find((e) => e.x === x && e.y === y);
  }
  return exits[0];
}

test('G1: town1→village1 出口(x:1,y:2) は secret_puzzle が必要', () => {
  const e = findExitTo('town1', 'village1', 1, 2);
  assert.ok(e, 'town1→village1(1,2) 出口が存在');
  assert.strictEqual(e.requireFlag, 'secret_puzzle');
  assert.strictEqual(typeof e.lockedMsg, 'string');
  assert.ok(e.lockedMsg.length > 0, 'lockedMsg が非空文字列');
});

test('G2: town2→field4 出口(x:7,y:16) は boss_water が必要', () => {
  const e = findExitTo('town2', 'field4', 7, 16);
  assert.ok(e, 'town2→field4(7,16) 出口が存在');
  assert.strictEqual(e.requireFlag, 'boss_water');
  assert.strictEqual(typeof e.lockedMsg, 'string');
  assert.ok(e.lockedMsg.length > 0, 'lockedMsg が非空文字列');
});

test('G3: town3→field6 出口(x:7,y:16) は boss_emperor が必要', () => {
  const e = findExitTo('town3', 'field6', 7, 16);
  assert.ok(e, 'town3→field6(7,16) 出口が存在');
  assert.strictEqual(e.requireFlag, 'boss_emperor');
  assert.strictEqual(typeof e.lockedMsg, 'string');
  assert.ok(e.lockedMsg.length > 0, 'lockedMsg が非空文字列');
});
