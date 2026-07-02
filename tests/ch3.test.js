'use strict';
const test = require('node:test');
const assert = require('node:assert');
const story = require('../src/data/story.js');

// 第2章まで全クリアの土台フラグ
const CH2_DONE = {
  joined_ikuma: true, joined_aoshi: true, joined_tomoki: true, joined_itsuki: true,
  boss_magma: true, boss_guardian: true, boss_kaiser: true,
  boss_dark_general: true, boss_ice: true, boss_forest: true, boss_neo_kaiser: true,
};

test('ch3: ネオ撃破直後の目標は 世界大会 予選', () => {
  const o = story.objectiveFor(CH2_DONE);
  assert.strictEqual(o.done, false);
  assert.ok(o.bar.includes('予選') || o.bar.includes('世界大会'), 'bar: ' + o.bar);
});

test('ch3: 予選突破後の目標は 準々決勝', () => {
  const o = story.objectiveFor(Object.assign({}, CH2_DONE, { wc_qualify: true }));
  assert.ok(o.bar.includes('じゅんじゅん'), 'bar: ' + o.bar);
});

test('ch3: ゼロス撃破後の目標は 神殿 試練1', () => {
  const o = story.objectiveFor(Object.assign({}, CH2_DONE, {
    wc_qualify: true, wc_quarter: true, wc_semi: true, boss_volg: true,
    nebula_f1: true, nebula_f2: true, nebula_f3: true, boss_zeros: true,
  }));
  assert.ok(o.bar.includes('しんでん') || o.bar.includes('試練') || o.bar.includes('しれん'), 'bar: ' + o.bar);
});

test('ch3: アステリオンまで全達成で done=true', () => {
  const o = story.objectiveFor(Object.assign({}, CH2_DONE, {
    wc_qualify: true, wc_quarter: true, wc_semi: true, boss_volg: true,
    nebula_f1: true, nebula_f2: true, nebula_f3: true, boss_zeros: true,
    trial_1: true, trial_2: true, trial_3: true, boss_asterion: true,
  }));
  assert.strictEqual(o.done, true);
  assert.ok(o.bar.includes('クリア'), 'bar: ' + o.bar);
});
