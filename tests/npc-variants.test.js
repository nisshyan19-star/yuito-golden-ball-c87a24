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
