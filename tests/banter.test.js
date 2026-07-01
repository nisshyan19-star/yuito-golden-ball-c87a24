const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// menu-scene.js の「はなす」＝会話イベント（掛け合い）の静的検証。
// createMenuScene 内クロージャなので直接は呼べない → ソースを読んで健全性をチェックする。
// 目的：バンドル鉄則①（トップレベル衝突ゼロ）と、会話プールの構造・整合性を守る。

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'scenes', 'menu-scene.js'), 'utf8');

test('主メニューに「はなす」(v:\'talk\') が存在する', () => {
  assert.ok(/label:\s*'はなす'\s*,\s*v:\s*'talk'/.test(SRC), '「はなす」項目が buildMain に無い');
});

test('talk の会話ヘルパ（talkCtx/talkPool/pickTalk）が定義されている', () => {
  ['talkCtx', 'talkPool', 'pickTalk'].forEach((fn) => {
    assert.ok(new RegExp('function\\s+' + fn + '\\s*\\(').test(SRC), fn + ' が定義されていない');
  });
});

test('onConfirm に talk 分岐があり createDialog を push する', () => {
  assert.ok(/case\s*'talk'\s*:/.test(SRC), "case 'talk' が無い");
  assert.ok(/S\.createDialog\(/.test(SRC), 'createDialog を使っていない');
});

// バンドル鉄則①：新規ヘルパは全て createMenuScene のクロージャ内で「関数宣言」であること。
// （トップレベルに素の const/let を作ると単一 index.html で同名衝突→黒画面になる）
test('会話ヘルパはトップレベル宣言ではない（クロージャ内・鉄則①）', () => {
  // トップレベル（行頭）に talkPool 等の関数宣言や const が無いこと＝必ずインデントされている。
  assert.ok(!/^(function|const|let|var)\s+(talkCtx|talkPool|pickTalk|talkKey)\b/m.test(SRC),
    '会話ヘルパが行頭（トップレベル）に露出している＝バンドル衝突リスク');
});

// createMenuScene のクロージャ本体（関数開始〜UMDエクスポート直前）を切り出す。
function menuBody() {
  const start = SRC.indexOf('function createMenuScene');
  const end = SRC.indexOf('// ── UMD');
  assert.ok(start >= 0 && end > start, 'createMenuScene 本体を切り出せない');
  return SRC.slice(start, end);
}

// talkPool() の中身を安全に評価して構造を検証する（本体全体は依存が多いので pool だけ抜き出す）。
function evalTalkPool() {
  const body = menuBody();
  const m = body.match(/function\s+talkPool\s*\(\s*\)\s*\{\s*return\s*(\[[\s\S]*?\]);\s*\}/);
  assert.ok(m, 'talkPool の return 配列を抽出できない');
  // eslint-disable-next-line no-eval
  return eval('(' + m[1] + ')');
}

test('会話プールは十分な件数を持つ', () => {
  const pool = evalTalkPool();
  assert.ok(Array.isArray(pool), 'talkPool が配列でない');
  assert.ok(pool.length >= 12, `会話が少なすぎる（${pool.length}件）`);
});

test('各会話は ctx / who / lines を正しく持つ', () => {
  const pool = evalTalkPool();
  const CTX = ['town', 'dungeon', 'field', 'any'];
  const CHARS = ['yuito', 'ikuma', 'aoshi', 'tomoki', 'itsuki'];
  pool.forEach((e, i) => {
    assert.ok(CTX.includes(e.ctx), `#${i} の ctx が不正: ${e.ctx}`);
    assert.ok(Array.isArray(e.who) && e.who.length > 0, `#${i} の who が空`);
    e.who.forEach((w) => assert.ok(CHARS.includes(w), `#${i} の who に未知のキャラ: ${w}`));
    assert.ok(Array.isArray(e.lines) && e.lines.length > 0, `#${i} の lines が空`);
    e.lines.forEach((ln, j) => {
      assert.strictEqual(typeof ln, 'string', `#${i}.${j} が文字列でない`);
      assert.ok(ln.length > 0, `#${i}.${j} が空文字`);
    });
  });
});

test('ユイト単独(who:[yuito])の any 会話が最低1つ＝プールは絶対に空にならない', () => {
  const pool = evalTalkPool();
  const solo = pool.filter((e) => e.ctx === 'any' && e.who.length === 1 && e.who[0] === 'yuito');
  assert.ok(solo.length >= 1, 'ユイト単独の any 会話が無い＝ソロ時に会話が空になる恐れ');
});

test('各コンテキスト(town/dungeon/field)にユイト単独会話がある＝どの場所でも成立', () => {
  const pool = evalTalkPool();
  ['town', 'dungeon', 'field'].forEach((ctx) => {
    const hit = pool.some((e) => e.ctx === ctx && e.who.length === 1 && e.who[0] === 'yuito');
    assert.ok(hit, `${ctx} にユイト単独会話が無い`);
  });
});

test('会話セリフの各ページは dialog 窓に収まる長さ（\\n分割後 各行17字・最大4行想定）', () => {
  const pool = evalTalkPool();
  pool.forEach((e, i) => {
    e.lines.forEach((page, j) => {
      // dialog.js は \n で行分割 → 各行を 17字で折り返す。折り返し後の総行数が5未満なら窓(約5行)に収まる。
      let rows = 0;
      page.split('\n').forEach((seg) => { rows += Math.max(1, Math.ceil(seg.length / 17)); });
      assert.ok(rows <= 4, `#${i}.${j} が窓に収まらない可能性（${rows}行）: ${page}`);
    });
  });
});
