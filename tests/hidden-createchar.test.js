const test = require('node:test');
const assert = require('node:assert');
const GS = require('../src/core/game-state.js');

test('createCharacter が gensu/mikity/nanaka を生成できる', () => {
  const g = GS.createCharacter('gensu');
  assert.strictEqual(g.id, 'gensu');
  assert.strictEqual(g.maxHp, 42);
  assert.strictEqual(g.atk, 30);
  assert.strictEqual(g.maxKiai, 100);
  assert.ok(g.skills.indexOf('ult_gensu') >= 0);
  const m = GS.createCharacter('mikity');
  assert.strictEqual(m.atk, 32);
  const n = GS.createCharacter('nanaka');
  assert.strictEqual(n.atk, 4);
});

test('NewGame+ の _JOINABLE に3人が含まれ、加入済みパーティ/控えのフラグが復元される', () => {
  const prev = {
    party: [ GS.createCharacter('yuito'), GS.createCharacter('gensu') ],
    roster: [ GS.createCharacter('mikity') ],
    achievements: { beat_kaiser: true },
    titles: {},
  };
  const ng = GS.createNewGamePlus(prev);
  assert.strictEqual(ng.flags['joined_gensu'], true);
  assert.strictEqual(ng.flags['joined_mikity'], true);
});
