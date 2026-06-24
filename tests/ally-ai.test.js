const test=require('node:test'); const assert=require('node:assert');
const { chooseAllyAction } = require('../src/logic/ally-ai.js');
const { makeRng } = require('../src/core/rng.js');

test('イツキは瀕死の味方がいれば回復を選ぶ', () => {
  const itsuki={id:'itsuki',mp:20,skills:['super_save']};
  const party=[{id:'yuito',hp:5,maxHp:60,dead:false}, itsuki];
  const a=chooseAllyAction(itsuki,party,[{id:'e1',hp:30,maxHp:30,dead:false}],makeRng(1));
  assert.strictEqual(a.type,'skill');
  assert.strictEqual(a.skillId,'super_save');
  assert.strictEqual(a.targetId,'yuito');
});
test('アオシは敵が2体以上なら全体技を選ぶ', () => {
  const aoshi={id:'aoshi',mp:20,skills:['razor_pass']};
  const enemies=[{id:'e1',hp:20,maxHp:20,dead:false},{id:'e2',hp:20,maxHp:20,dead:false}];
  const a=chooseAllyAction(aoshi,[aoshi],enemies,makeRng(1));
  assert.strictEqual(a.type,'skill');
  assert.strictEqual(a.skillId,'razor_pass');
});
test('アオシは敵が1体なら全体技を選ばない（通常攻撃）', () => {
  const aoshi={id:'aoshi',mp:20,skills:['razor_pass']};
  const a=chooseAllyAction(aoshi,[aoshi],[{id:'e1',hp:20,maxHp:20,dead:false}],makeRng(1));
  assert.strictEqual(a.type,'attack');
  assert.strictEqual(a.targetId,'e1');
});
test('イクマはMPが足りれば必殺技を選ぶ', () => {
  const ikuma={id:'ikuma',mp:20,skills:['header']};
  const party=[ikuma,{id:'yuito',hp:50,maxHp:60,dead:false}];
  const a=chooseAllyAction(ikuma,party,[{id:'e1',hp:20,maxHp:20,dead:false}],makeRng(1));
  assert.strictEqual(a.type,'skill');
  assert.strictEqual(a.skillId,'header');
});
test('イクマはMP不足なら通常攻撃', () => {
  const ikuma={id:'ikuma',mp:1,skills:['header']};
  const a=chooseAllyAction(ikuma,[ikuma],[{id:'e1',hp:20,maxHp:20,dead:false}],makeRng(1));
  assert.strictEqual(a.type,'attack');
  assert.strictEqual(a.targetId,'e1');
});
test('トモキは瀕死の味方がいれば かばう', () => {
  const tomoki={id:'tomoki',mp:20,skills:['tackle','guard']};
  const party=[tomoki,{id:'yuito',hp:5,maxHp:60,dead:false}];
  const a=chooseAllyAction(tomoki,party,[{id:'e1',hp:20,maxHp:20,dead:false}],makeRng(1));
  assert.strictEqual(a.type,'cover');
  assert.strictEqual(a.targetId,'yuito');
});
test('イツキはMP不足なら回復できず通常攻撃', () => {
  const itsuki={id:'itsuki',mp:0,skills:['super_save']};
  const party=[itsuki,{id:'yuito',hp:5,maxHp:60,dead:false}];
  const a=chooseAllyAction(itsuki,party,[{id:'e1',hp:20,maxHp:20,dead:false}],makeRng(1));
  assert.strictEqual(a.type,'attack');
});
test('瀕死の味方がいなければ回復もかばうも選ばない', () => {
  const itsuki={id:'itsuki',mp:20,skills:['super_save']};
  const party=[itsuki,{id:'yuito',hp:55,maxHp:60,dead:false}];
  const a=chooseAllyAction(itsuki,party,[{id:'e1',hp:20,maxHp:20,dead:false}],makeRng(1));
  assert.notStrictEqual(a.type,'cover');
  assert.notStrictEqual(a.skillId,'super_save');
});
test('通常攻撃は最もHPの低い生存敵を狙う', () => {
  const ikuma={id:'ikuma',mp:0,skills:['header']};
  const enemies=[{id:'e1',hp:20,maxHp:20,dead:false},{id:'e2',hp:3,maxHp:20,dead:false}];
  const a=chooseAllyAction(ikuma,[ikuma],enemies,makeRng(1));
  assert.strictEqual(a.type,'attack');
  assert.strictEqual(a.targetId,'e2');
});
