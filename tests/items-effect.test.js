const test=require('node:test'); const assert=require('node:assert');
const { useItem, applyEquip } = require('../src/logic/items-effect.js');

test('HP回復は maxHp を超えない', () => {
  const t={hp:50,maxHp:60,mp:5,maxMp:20,dead:false};
  const r=useItem(t,{kind:'item',effect:{hp:100}});
  assert.strictEqual(t.hp,60);
  assert.ok(r.ok);
});
test('MP回復は maxMp を超えない', () => {
  const t={hp:50,maxHp:60,mp:18,maxMp:20,dead:false};
  useItem(t,{kind:'item',effect:{mp:100}});
  assert.strictEqual(t.mp,20);
});
test('リスタートの笛で戦闘不能から復活し hp>0', () => {
  const t={hp:0,maxHp:60,mp:0,maxMp:20,dead:true};
  const r=useItem(t,{kind:'item',effect:{revive:0.5}});
  assert.ok(!t.dead && t.hp>0);
  assert.ok(r.ok);
});
test('生存中に復活アイテムはむだ（ok:false・状態不変）', () => {
  const t={hp:30,maxHp:60,dead:false};
  const r=useItem(t,{kind:'item',effect:{revive:0.5}});
  assert.strictEqual(r.ok,false);
  assert.strictEqual(t.hp,30);
});
test('戦闘不能に回復薬は効かない（ok:false・hp不変）', () => {
  const t={hp:0,maxHp:60,mp:0,maxMp:20,dead:true};
  const r=useItem(t,{kind:'item',effect:{hp:100}});
  assert.strictEqual(r.ok,false);
  assert.strictEqual(t.hp,0);
});
test('武器装備で実効 atk が上がり、元は不変', () => {
  const c={atk:10,def:7,equip:{weapon:'spike1',armor:null}};
  const eff=applyEquip(c);
  assert.strictEqual(eff.atk,13); // spike1 atk+3
  assert.strictEqual(eff.def,7);
  assert.strictEqual(c.atk,10);   // 非破壊
});
test('防具装備で実効 def が上がる', () => {
  const c={atk:10,def:7,equip:{weapon:null,armor:'uni1'}};
  const eff=applyEquip(c);
  assert.strictEqual(eff.def,10); // uni1 def+3
});
test('未装備なら素の値', () => {
  const c={atk:10,def:7,equip:{weapon:null,armor:null}};
  const eff=applyEquip(c);
  assert.strictEqual(eff.atk,10);
  assert.strictEqual(eff.def,7);
});
