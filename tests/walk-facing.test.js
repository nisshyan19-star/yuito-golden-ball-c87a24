const test   = require('node:test');
const assert = require('node:assert');
const { walkSideFlip } = require('../src/scenes/field-scene.js');

// フィールド歩行スプライトの左右反転ロジックの回帰テスト。
// バグ：イクマの side 素材だけAI生成が「右向き」なのに、描画側が全キャラ「左向き」前提で
//       反転していたため、イクマだけ左右が逆に見えていた（げんちゃん報告 2026-07-01）。
// 仕様：left へ歩くとき素材の向きが「左」ならそのまま(false)、「右」なら反転(true)。

// ── 通常キャラ（side素材＝左向き）：右移動のときだけ反転 ────────────────
['yuito', 'aoshi', 'tomoki', 'itsuki'].forEach((id) => {
  test(`${id}: 右移動のとき反転(true)`, () => {
    assert.strictEqual(walkSideFlip(id, 'right'), true);
  });
  test(`${id}: 左移動のとき反転しない(false)`, () => {
    assert.strictEqual(walkSideFlip(id, 'left'), false);
  });
});

// ── イクマ（side素材＝右向き）：左移動のときだけ反転 ──────────────────
test('ikuma: 左移動のとき反転(true)＝右向き素材を左向きにする', () => {
  assert.strictEqual(walkSideFlip('ikuma', 'left'), true);
});
test('ikuma: 右移動のとき反転しない(false)＝右向き素材をそのまま使う', () => {
  assert.strictEqual(walkSideFlip('ikuma', 'right'), false);
});

// ── 上下移動では反転しない（全キャラ共通・side素材を使わない向き） ──────
['yuito', 'ikuma', 'aoshi', 'tomoki', 'itsuki'].forEach((id) => {
  test(`${id}: up/down では反転しない`, () => {
    assert.strictEqual(walkSideFlip(id, 'up'), false);
    assert.strictEqual(walkSideFlip(id, 'down'), false);
  });
});
