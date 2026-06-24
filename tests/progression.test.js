const test=require('node:test'); const assert=require('node:assert');
const { expForNextLevel, gainExp } = require('../src/logic/progression.js');

test('必要経験値はレベルとともに増える（やさしくゆるやか）', () => {
  assert.ok(expForNextLevel(1) < expForNextLevel(5));
});
test('十分な経験値でレベルアップし HP最大値が増える', () => {
  const c = { level:1, exp:0, maxHp:30, hp:30, maxMp:10, mp:10, atk:8, def:6, spd:7,
              growth:{hp:6,mp:3,atk:2,def:2,spd:1}, skills:[], id:'yuito' };
  const r = gainExp(c, 1000);
  assert.ok(r.leveledUp);
  assert.ok(c.level >= 2);
  assert.ok(c.maxHp > 30);
});
test('習得レベル到達で技を覚える', () => {
  const c = { level:5, exp:0, maxHp:60, hp:60, maxMp:20, mp:20, atk:14, def:10, spd:11,
              growth:{hp:6,mp:3,atk:2,def:2,spd:1}, skills:['drive_shoot'], id:'yuito' };
  const r = gainExp(c, 1000); // Lv6 で overhead 習得
  assert.ok(c.skills.includes('overhead'));
});
