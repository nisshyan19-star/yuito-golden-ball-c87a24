// tests/hidden-skills.test.js
// 隠し仲間3人の新とくぎ6種の定義を検証
const assert = require('node:assert');
const { test } = require('node:test');
const { SKILLS } = require('../src/data/skills.js');

test('通常わざ dark_drive/siren_shot/poka_punch が定義されている', () => {
  assert.ok(SKILLS.dark_drive, 'dark_drive');
  assert.strictEqual(SKILLS.dark_drive.user, 'gensu');
  assert.strictEqual(SKILLS.dark_drive.type, 'attack');

  assert.ok(SKILLS.siren_shot, 'siren_shot');
  assert.strictEqual(SKILLS.siren_shot.user, 'mikity');

  assert.ok(SKILLS.poka_punch, 'poka_punch');
  assert.strictEqual(SKILLS.poka_punch.user, 'nanaka');
});

test('必殺技 ult_gensu/ult_mikity/ult_nanaka が定義されている', () => {
  assert.ok(SKILLS.ult_gensu, 'ult_gensu');
  assert.strictEqual(SKILLS.ult_gensu.kiai, 100);
  assert.strictEqual(SKILLS.ult_gensu.learnLevel, null);

  assert.ok(SKILLS.ult_mikity, 'ult_mikity');
  assert.strictEqual(SKILLS.ult_mikity.kiai, 100);

  assert.ok(SKILLS.ult_nanaka, 'ult_nanaka');
  assert.strictEqual(SKILLS.ult_nanaka.kiai, 100);
});

test('イヤイヤ期は敵全体対象で全とくぎ中の最大威力', () => {
  assert.strictEqual(SKILLS.ult_nanaka.target, 'all');
  const maxPower = Object.keys(SKILLS).reduce((m, k) => {
    const p = SKILLS[k].power || 0;
    return p > m ? p : m;
  }, 0);
  assert.strictEqual(SKILLS.ult_nanaka.power, maxPower);
});
