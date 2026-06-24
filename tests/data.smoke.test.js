const test = require('node:test');
const assert = require('node:assert');
const { SKILLS } = require('../src/data/skills.js');
const { CHARACTERS } = require('../src/data/characters.js');
const { ITEMS } = require('../src/data/items.js');
const { ENEMIES } = require('../src/data/enemies.js');
const { createCharacter, createNewGame, cloneState } = require('../src/core/game-state.js');

test('全 skill が name と mp>=0 を持つ', () => {
  for (const k in SKILLS) { assert.ok(SKILLS[k].name, k); assert.ok(SKILLS[k].mp >= 0, k); }
});
test('5キャラそろっている', () => {
  for (const id of ['yuito','ikuma','aoshi','tomoki','itsuki']) assert.ok(CHARACTERS[id], id);
});
test('全 item に id/name/kind/price', () => {
  for (const k in ITEMS) { const i = ITEMS[k]; assert.strictEqual(i.id, k); assert.ok(i.name && i.kind && i.price >= 0, k); }
});
test('敵にザコとボスがいる', () => {
  assert.ok(ENEMIES.foul_goblin && !ENEMIES.foul_goblin.isBoss);
  assert.ok(ENEMIES.dark_kaiser && ENEMIES.dark_kaiser.isBoss);
});
test('createCharacter はLv1・HP満タンの実行時キャラを返す', () => {
  const c = createCharacter('yuito');
  assert.strictEqual(c.level, 1);
  assert.strictEqual(c.hp, c.maxHp);
  assert.ok(c.maxHp > 0 && c.atk > 0);
  assert.deepStrictEqual(c.equip, { weapon: null, armor: null });
});
test('createCharacter は元データを破壊しない（skills独立）', () => {
  const c = createCharacter('yuito');
  c.skills.push('XXX');
  assert.ok(!CHARACTERS.yuito.skills.includes('XXX'));
});
test('createNewGame はユイトのみ・gold0・autoAllies true', () => {
  const g = createNewGame();
  assert.strictEqual(g.party.length, 1);
  assert.strictEqual(g.party[0].id, 'yuito');
  assert.strictEqual(g.gold, 0);
  assert.strictEqual(g.settings.autoAllies, true);
});
test('cloneState は深いコピー', () => {
  const g = createNewGame();
  const c = cloneState(g);
  c.gold = 999;
  assert.strictEqual(g.gold, 0);
});
