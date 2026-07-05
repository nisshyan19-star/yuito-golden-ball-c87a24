const test = require('node:test');
const assert = require('node:assert');
const { joinAlly } = require('../src/data/story.js');
const GS = require('../src/core/game-state.js');

function baseState() {
  return { party: [ GS.createCharacter('yuito') ], roster: [], flags: {} };
}

test('joinAlly: 上限4を超える加入はrosterへ回る', () => {
  const s = baseState();
  ['ikuma','aoshi','tomoki'].forEach((id) => joinAlly(s, id)); // party=4(満杯)
  assert.strictEqual(s.party.length, 4);
  const name = joinAlly(s, 'itsuki'); // 5人目→roster
  assert.ok(name);
  assert.strictEqual(s.party.length, 4, 'partyは上限4のまま');
  assert.strictEqual(s.roster.length, 1);
  assert.strictEqual(s.roster[0].id, 'itsuki');
  assert.strictEqual(s.flags['joined_itsuki'], true);
});

test('joinAlly: roster在籍キャラは二重加入しない', () => {
  const s = baseState();
  ['ikuma','aoshi','tomoki','itsuki'].forEach((id) => joinAlly(s, id)); // itsukiはroster
  assert.strictEqual(joinAlly(s, 'itsuki'), null, 'roster在籍なら再加入nullのはず');
  assert.strictEqual(s.roster.length, 1);
});
