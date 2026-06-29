// === new-skills.test.js（追加弾3：新とくぎ） ===
// 中盤で覚える新スキルが正しい型で定義され、レベルアップで自動習得されることを検証。
const test   = require('node:test');
const assert = require('node:assert');
const { SKILLS } = require('../src/data/skills.js');
const { createCharacter } = require('../src/core/game-state.js');
const { gainExp, expForNextLevel } = require('../src/logic/progression.js');

const NEW_SKILLS = ['rolling_shoot', 'hat_trick', 'through_pass', 'iron_wall', 'recovery_call'];

test('新スキル5つが存在し、解決可能な型(attack/heal/buff_def)である', () => {
  // battle-scene の _useSkill が解決し、技メニューに出るのは attack/heal/buff_def のみ
  const ok = { attack: 1, heal: 1, buff_def: 1 };
  NEW_SKILLS.forEach((id) => {
    const sk = SKILLS[id];
    assert.ok(sk, '新スキルが無い: ' + id);
    assert.ok(ok[sk.type], id + ' の型が解決不能: ' + sk.type);
    assert.ok(sk.user, id + ' に user が無い');
    assert.ok(typeof sk.learnLevel === 'number' && sk.learnLevel >= 11, id + ' の learnLevel が中盤でない');
    assert.ok(!sk.kiai, id + ' は通常技なので kiai を持たない');
  });
});

test('各キャラが新スキルを1つずつ持つ（user の割り当て）', () => {
  const byUser = {};
  NEW_SKILLS.forEach((id) => { byUser[SKILLS[id].user] = (byUser[SKILLS[id].user] || 0) + 1; });
  ['yuito', 'ikuma', 'aoshi', 'tomoki', 'itsuki'].forEach((u) => {
    assert.strictEqual(byUser[u], 1, u + ' の新スキルが1つでない');
  });
});

test('レベルアップで新スキルが自動習得される（ユイト rolling_shoot @Lv12）', () => {
  const c = createCharacter('yuito');
  assert.ok(!c.skills.includes('rolling_shoot'), '最初から持っていてはいけない');
  // Lv12 まで一気に経験値を流す
  let total = 0;
  for (let lv = 1; lv < 12; lv++) total += expForNextLevel(lv);
  const r = gainExp(c, total);
  assert.ok(c.level >= 12, 'Lv12 に到達していない: ' + c.level);
  assert.ok(c.skills.includes('rolling_shoot'), 'rolling_shoot を習得していない');
  assert.ok(r.learned.includes('rolling_shoot'), 'learned に rolling_shoot が無い');
});

test('learnLevel 未満では習得しない（itsuki recovery_call @Lv13 を Lv12 で確認）', () => {
  const c = createCharacter('itsuki');
  let total = 0;
  for (let lv = 1; lv < 12; lv++) total += expForNextLevel(lv);
  gainExp(c, total);
  assert.ok(c.level >= 12, 'Lv12 に到達していない');
  assert.ok(!c.skills.includes('recovery_call'), 'Lv12 で recovery_call を覚えてはいけない（Lv13習得）');
});
