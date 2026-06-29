const test=require('node:test'); const assert=require('node:assert');
const { calcDamage, applyDamage, isDefeated, typeMultiplier } = require('../src/logic/battle.js');
const { makeRng } = require('../src/core/rng.js');

test('こうげき>しゅび で1以上のダメージ', () => {
  const d = calcDamage({atk:20},{def:6},{power:1, rng:makeRng(1)});
  assert.ok(d >= 1);
});
test('しゅびが高くても最低1ダメージ', () => {
  const d = calcDamage({atk:5},{def:99},{power:1, rng:makeRng(1)});
  assert.ok(d >= 1);
});
test('power 倍率が効く（同seed）', () => {
  const lo=calcDamage({atk:20},{def:6},{power:1,rng:makeRng(5)});
  const hi=calcDamage({atk:20},{def:6},{power:2,rng:makeRng(5)});
  assert.ok(hi > lo);
});
test('crit:true は crit:false より大きい（同seed）', () => {
  const base=calcDamage({atk:20},{def:6},{power:1,rng:makeRng(7),crit:false});
  const cr  =calcDamage({atk:20},{def:6},{power:1,rng:makeRng(7),crit:true});
  assert.ok(cr > base);
});
test('opts 省略でも power=1 として動く', () => {
  const d = calcDamage({atk:20},{def:6});
  assert.ok(d >= 1);
});
test('applyDamage は hp を減らし0未満にならず、0で dead', () => {
  const t={hp:10, dead:false};
  applyDamage(t, 4); assert.strictEqual(t.hp, 6);
  applyDamage(t, 100); assert.strictEqual(t.hp, 0);
  assert.strictEqual(t.dead, true);
});
test('isDefeated は hp0/dead で true、生存で false', () => {
  assert.strictEqual(isDefeated({hp:0,dead:true}), true);
  assert.strictEqual(isDefeated({hp:5,dead:false}), false);
});

// ── タイプ相性（3すくみ）─────────────────────────────────────────────
test('typeMultiplier: 有利は1.5倍（パワー→テクニック）', () => {
  assert.strictEqual(typeMultiplier('power', 'technique'), 1.5);
  assert.strictEqual(typeMultiplier('technique', 'speed'), 1.5);
  assert.strictEqual(typeMultiplier('speed', 'power'), 1.5);
});
test('typeMultiplier: 不利は0.75倍（逆向き）', () => {
  assert.strictEqual(typeMultiplier('power', 'speed'), 0.75);
  assert.strictEqual(typeMultiplier('technique', 'power'), 0.75);
  assert.strictEqual(typeMultiplier('speed', 'technique'), 0.75);
});
test('typeMultiplier: 同タイプ・不明タイプは等倍', () => {
  assert.strictEqual(typeMultiplier('power', 'power'), 1);
  assert.strictEqual(typeMultiplier('power', null), 1);
  assert.strictEqual(typeMultiplier(undefined, 'power'), 1);
  assert.strictEqual(typeMultiplier('mystery', 'power'), 1);
});
test('calcDamage: typeMul=1.5 は等倍より大きい（同seed）', () => {
  const base = calcDamage({atk:30},{def:6},{power:1, rng:makeRng(3), typeMul:1.0});
  const adv  = calcDamage({atk:30},{def:6},{power:1, rng:makeRng(3), typeMul:1.5});
  assert.ok(adv > base);
});
