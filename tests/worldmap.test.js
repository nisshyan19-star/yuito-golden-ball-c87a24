'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { WORLD_MAP_NODES, visibleWorldNodes, fastTravelTowns } = require('../src/scenes/menu-scene.js');

test('WORLD_MAP_NODES が配列で主要ノードを含む', () => {
  assert.ok(Array.isArray(WORLD_MAP_NODES));
  assert.ok(WORLD_MAP_NODES.length >= 10);
  const ids = WORLD_MAP_NODES.map(n => n.id);
  ['field1', 'town1', 'cave1', 'tower_ice', 'shrine_forest', 'cave_water', 'town2', 'town3', 'ch2_town'].forEach(id => {
    assert.ok(ids.indexOf(id) >= 0, 'ノード欠落: ' + id);
  });
});

test('各ノードは maps 配列を持ち、normalized 座標を持つ', () => {
  WORLD_MAP_NODES.forEach(n => {
    assert.ok(Array.isArray(n.maps) && n.maps.length >= 1, 'maps 欠落: ' + n.id);
    assert.ok(typeof n.x === 'number' && n.x >= 0 && n.x <= 1, 'x 範囲外: ' + n.id);
    assert.ok(typeof n.y === 'number' && n.y >= 0 && n.y <= 1, 'y 範囲外: ' + n.id);
    assert.ok(['town', 'field', 'dungeon'].indexOf(n.type) >= 0, 'type 不正: ' + n.id);
  });
});

test('ダンジョンノードは各階を maps に集約する', () => {
  const tower = WORLD_MAP_NODES.find(n => n.id === 'tower_ice');
  assert.deepStrictEqual(tower.maps, ['tower_ice_1f', 'tower_ice_2f', 'tower_ice_3f']);
});

test('町ノードは warp 座標を持つ', () => {
  WORLD_MAP_NODES.filter(n => n.type === 'town').forEach(n => {
    assert.ok(n.warp && typeof n.warp.x === 'number' && typeof n.warp.y === 'number', 'warp 欠落: ' + n.id);
  });
});

test('visibleWorldNodes: 訪問済みマップを含むノードだけ返す', () => {
  const visited = { field1: true };
  const vis = visibleWorldNodes(WORLD_MAP_NODES, visited);
  assert.ok(vis.some(n => n.id === 'field1'));
  assert.ok(!vis.some(n => n.id === 'ch2_castle'));
});

test('visibleWorldNodes: visited 未定義でも落ちず空配列', () => {
  assert.deepStrictEqual(visibleWorldNodes(WORLD_MAP_NODES, undefined), []);
  assert.deepStrictEqual(visibleWorldNodes(WORLD_MAP_NODES, {}), []);
});

test('fastTravelTowns: 訪問済みの町ノードだけ返す', () => {
  const visited = { town1: true, field1: true };
  const towns = fastTravelTowns(WORLD_MAP_NODES, visited);
  assert.ok(towns.every(n => n.type === 'town' && n.warp));
  assert.ok(towns.some(n => n.id === 'town1'));
  assert.ok(!towns.some(n => n.id === 'field1')); // field は町でない
});

test('fastTravelTowns: ダンジョンのある階を1つでも踏めば入口ノード可視', () => {
  const vis = visibleWorldNodes(WORLD_MAP_NODES, { tower_ice_2f: true });
  assert.ok(vis.some(n => n.id === 'tower_ice'));
});
