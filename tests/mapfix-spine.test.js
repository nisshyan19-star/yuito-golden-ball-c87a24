const { test } = require('node:test');
const assert = require('node:assert');
const { objectiveFor } = require('../src/data/story.js');

// 新スパイン順序（★＝今回挿入した4フラグ）
// joined_ikuma → ★secret_puzzle → boss_magma → joined_aoshi → joined_tomoki
// → ★boss_water → joined_itsuki → boss_guardian → ★boss_emperor → ★challenge_clear
// → boss_kaiser → boss_dark_general → …（以降不変）
const ORDER = [
  ['joined_ikuma', 'イクマを なかまに しよう！'],
  ['secret_puzzle', 'ハーバータウンの ひみつを といて！'],
  ['boss_magma', 'ほのおの どうくつへ！'],
  ['joined_aoshi', 'アオシを なかまに しよう！'],
  ['joined_tomoki', 'トモキを なかまに しよう！'],
  ['boss_water', 'みずのどうくつへ！'],
  ['joined_itsuki', 'イツキを なかまに しよう！'],
  ['boss_guardian', 'スカイスタジアムへ！'],
  ['boss_emperor', 'でんせつのアリーナへ！'],
  ['challenge_clear', 'ちょうせんの間へ！'],
  ['boss_kaiser', 'ダークアリーナへ！'],
];

test('objectiveFor は新スパイン順に「未達の最初の目標」を返す', () => {
  const flags = {};
  for (const [flag, expectedBar] of ORDER) {
    const obj = objectiveFor(flags);
    assert.strictEqual(obj.bar, expectedBar, `flag=${flag} の直前で bar 不一致`);
    assert.strictEqual(obj.done, false);
    flags[flag] = true; // このフラグを立てて次へ
  }
});

test('boss_kaiser 以降の順序は不変（boss_dark_general が続く）', () => {
  const flags = {};
  for (const [flag] of ORDER) flags[flag] = true;
  const obj = objectiveFor(flags);
  assert.strictEqual(obj.bar, 'こおりの とうげへ！');
});
