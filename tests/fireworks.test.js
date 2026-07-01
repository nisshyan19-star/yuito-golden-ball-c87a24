const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// ⑥ おまかせ盛り＝タイトルの「お祝い花火」の静的検証。
// createTitleScene 内クロージャなので直接は呼べない → ソースを読んで健全性をチェックする。
// 目的：バンドル鉄則①（トップレベル衝突ゼロ）と、花火システムの配線・整合性を守る。

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'scenes', 'title-scene.js'), 'utf8');

test('花火ヘルパ（_spawnFirework/_stepFireworks/_drawFireworks）が定義されている', () => {
  ['_spawnFirework', '_stepFireworks', '_drawFireworks'].forEach((fn) => {
    assert.ok(new RegExp('function\\s+' + fn + '\\s*\\(').test(SRC), fn + ' が定義されていない');
  });
});

test('update で _stepFireworks(dt) を回している', () => {
  assert.ok(/_stepFireworks\(dt\)/.test(SRC), 'update から _stepFireworks(dt) を呼んでいない');
});

test('draw で _drawFireworks(ctx) を呼んでいる', () => {
  assert.ok(/_drawFireworks\(ctx\)/.test(SRC), 'draw から _drawFireworks(ctx) を呼んでいない');
});

// バンドル鉄則①：新規識別子は全て createTitleScene のクロージャ内で宣言（＝必ずインデント）。
// トップレベル（行頭）に露出すると単一 index.html で同名衝突→黒画面になる。
test('花火の識別子はトップレベル宣言ではない（クロージャ内・鉄則①）', () => {
  assert.ok(!/^(function|const|let|var)\s+(_spawnFirework|_stepFireworks|_drawFireworks|_fw|_fwTimer|_FW_COLORS)\b/m.test(SRC),
    '花火の識別子が行頭（トップレベル）に露出している＝バンドル衝突リスク');
});

// createTitleScene クロージャ本体（関数開始〜UMDエクスポート直前）を切り出す。
function titleBody() {
  const start = SRC.indexOf('function createTitleScene');
  const end = SRC.lastIndexOf('if (typeof module');
  assert.ok(start >= 0 && end > start, 'createTitleScene 本体を切り出せない');
  return SRC.slice(start, end);
}

test('花火の色パレットは配列で 1色以上ある', () => {
  const body = titleBody();
  const m = body.match(/_FW_COLORS\s*=\s*(\[[\s\S]*?\]);/);
  assert.ok(m, '_FW_COLORS の配列を抽出できない');
  // eslint-disable-next-line no-eval
  const colors = eval('(' + m[1] + ')');
  assert.ok(Array.isArray(colors) && colors.length >= 1, '色パレットが空');
  colors.forEach((c) => assert.ok(/^#[0-9a-fA-F]{6}$/.test(c), '色が16進6桁でない: ' + c));
});

test('花火は rise（のぼる）と burst（ひらく）の2フェーズを持つ', () => {
  const body = titleBody();
  assert.ok(/phase:\s*'rise'/.test(body), 'rise フェーズが無い');
  assert.ok(/s\.phase\s*=\s*'burst'/.test(body), 'burst への遷移が無い');
});

test('同時に描く花火の数に上限ガードがある（負荷対策）', () => {
  const body = titleBody();
  assert.ok(/_fw\.length\s*>\s*\d+/.test(body), '花火数の上限ガードが無い');
});
