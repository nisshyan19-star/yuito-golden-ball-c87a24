// tests/hidden-characters.test.js
// 隠し仲間3人のキャラ定義を検証
const assert = require('node:assert');
const { test } = require('node:test');
const { CHARACTERS } = require('../src/data/characters.js');
const { SKILLS } = require('../src/data/skills.js');

test('gensu/mikity/nanaka が CHARACTERS に定義されている', () => {
  ['gensu', 'mikity', 'nanaka'].forEach((id) => {
    const c = CHARACTERS[id];
    assert.ok(c, id + ' が存在する');
    assert.strictEqual(c.id, id);
    assert.ok(c.base && typeof c.base.atk === 'number', id + ' base');
    assert.ok(c.growth && typeof c.growth.atk === 'number', id + ' growth');
    assert.ok(Array.isArray(c.skills) && c.skills.length >= 2, id + ' skills');
    c.skills.forEach((sk) => assert.ok(SKILLS[sk], id + ' の skill ' + sk + ' が実在'));
    assert.ok(c.profile && Array.isArray(c.profile.bio) && c.profile.bio.length === 3, id + ' profile.bio');
  });
});

test('ミキティーの攻撃力(base+growth)はゲンスより高い', () => {
  const g = CHARACTERS.gensu, m = CHARACTERS.mikity;
  assert.ok(m.base.atk > g.base.atk, 'base.atk mikity>gensu');
  assert.ok((m.base.atk + m.growth.atk) > (g.base.atk + g.growth.atk), '合計 atk mikity>gensu');
});

test('加入チャプター: mikity=1, nanaka=2, gensu=3', () => {
  assert.strictEqual(CHARACTERS.mikity.joinChapter, 1);
  assert.strictEqual(CHARACTERS.nanaka.joinChapter, 2);
  assert.strictEqual(CHARACTERS.gensu.joinChapter, 3);
});
