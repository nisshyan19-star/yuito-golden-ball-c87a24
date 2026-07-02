'use strict';
const test = require('node:test');
const assert = require('node:assert');
global.window = global.window || {};
const S = require('../src/scenes/field-scene.js');

test('npcPagesFor: variants 無しなら pages を返す', () => {
  const npc = { pages: ['もと'] };
  assert.deepStrictEqual(S.npcPagesFor(npc, {}), ['もと']);
});
test('npcPagesFor: requireFlag 未達なら pages を返す', () => {
  const npc = { pages: ['もと'], variants: [{ requireFlag: 'x', pages: ['へんか'] }] };
  assert.deepStrictEqual(S.npcPagesFor(npc, {}), ['もと']);
});
test('npcPagesFor: 複数該当は最後（最も進んだ）variant を返す', () => {
  const npc = { pages: ['もと'], variants: [
    { requireFlag: 'a', pages: ['A'] },
    { requireFlag: 'b', pages: ['B'] },
  ] };
  assert.deepStrictEqual(S.npcPagesFor(npc, { a: true }), ['A']);
  assert.deepStrictEqual(S.npcPagesFor(npc, { a: true, b: true }), ['B']);
});

const MAPS = require('../src/data/maps.js').MAPS;

test('伏線: field1 コーチ(4,9) がイクマ加入前にヒント／加入後に変化', () => {
  const npc = (MAPS.field1.npcs || []).find((n) => n.x === 4 && n.y === 9);
  assert.ok(npc, 'field1(4,9) NPC 存在');
  assert.ok(JSON.stringify(npc.pages).includes('FW') || JSON.stringify(npc.pages).includes('はやて'),
    'イクマ伏線がある');
  assert.ok(Array.isArray(npc.variants) && npc.variants.some((v) => v.requireFlag === 'joined_ikuma'),
    '加入後 variant がある');
});

test('進行変化: town1 住民に boss_magma 後の variant がある', () => {
  const has = (MAPS.town1.npcs || []).some((n) =>
    Array.isArray(n.variants) && n.variants.some((v) => v.requireFlag === 'boss_magma'));
  assert.ok(has, 'town1 に boss_magma variant');
});
