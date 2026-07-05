const test   = require('node:test');
const assert = require('node:assert');
const { walkSideFlip } = require('../src/scenes/field-scene.js');

// フィールド歩行スプライトの左右反転ロジックの回帰テスト。
// バグ：side素材の実際の向きは yuito だけ「左向き」・ikuma/aoshi/tomoki/itsuki は「右向き」なのに、
//       描画側のメタデータが「右向きはイクマだけ」と誤っていたため、aoshi/tomoki/itsuki が
//       左右逆を向いて歩いていた（げんちゃん報告 2026-07-04・実画像検証で確定）。
// 仕様：素材の向きと逆へ歩くときだけ反転(true)。
//       side素材が「右向き」なら left へ歩くとき反転、「左向き」なら right へ歩くとき反転。

// ── ユイト（side素材＝左向き）：右移動のときだけ反転 ──────────────────
test('yuito: 右移動のとき反転(true)＝左向き素材を右向きにする', () => {
  assert.strictEqual(walkSideFlip('yuito', 'right'), true);
});
test('yuito: 左移動のとき反転しない(false)＝左向き素材をそのまま使う', () => {
  assert.strictEqual(walkSideFlip('yuito', 'left'), false);
});

// ── ikuma/aoshi/tomoki/itsuki（side素材＝右向き）：左移動のときだけ反転 ──
['ikuma', 'aoshi', 'tomoki', 'itsuki'].forEach((id) => {
  test(`${id}: 左移動のとき反転(true)＝右向き素材を左向きにする`, () => {
    assert.strictEqual(walkSideFlip(id, 'left'), true);
  });
  test(`${id}: 右移動のとき反転しない(false)＝右向き素材をそのまま使う`, () => {
    assert.strictEqual(walkSideFlip(id, 'right'), false);
  });
});

// ── 上下移動では反転しない（全キャラ共通・side素材を使わない向き） ──────
['yuito', 'ikuma', 'aoshi', 'tomoki', 'itsuki'].forEach((id) => {
  test(`${id}: up/down では反転しない`, () => {
    assert.strictEqual(walkSideFlip(id, 'up'), false);
    assert.strictEqual(walkSideFlip(id, 'down'), false);
  });
});
