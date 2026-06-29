// === titles.test.js（追加弾4-A：称号システム） ===
// 称号データの形・実績連動の解除判定・装備/解除・能力ボーナスの純関数を検証する。
const test   = require('node:test');
const assert = require('node:assert');
const {
  createNewGame, ACHIEVEMENTS,
  TITLES, titleBonus, unlockedTitles, equipTitle,
} = require('../src/core/game-state.js');

// ── データ形 ──────────────────────────────────────────────────────────
test('TITLES は {id,name,desc,req,bonus:{atk,def}} の配列で id は一意', () => {
  assert.ok(Array.isArray(TITLES) && TITLES.length >= 10, 'TITLES が配列で10件以上');
  const ids = {};
  TITLES.forEach((t) => {
    assert.ok(t.id && typeof t.id === 'string', 'id が無い');
    assert.ok(t.name && typeof t.name === 'string', 'name が無い: ' + t.id);
    assert.ok(t.desc && typeof t.desc === 'string', 'desc が無い: ' + t.id);
    assert.ok(t.req && typeof t.req === 'string', 'req が無い: ' + t.id);
    assert.ok(t.bonus && typeof t.bonus === 'object', 'bonus が無い: ' + t.id);
    assert.strictEqual(typeof t.bonus.atk, 'number', 'bonus.atk が数値でない: ' + t.id);
    assert.strictEqual(typeof t.bonus.def, 'number', 'bonus.def が数値でない: ' + t.id);
    assert.ok(!ids[t.id], 'id 重複: ' + t.id);
    ids[t.id] = true;
  });
});

test('全称号の req は実在する実績 id を指す', () => {
  const achIds = {};
  ACHIEVEMENTS.forEach((a) => { achIds[a.id] = true; });
  TITLES.forEach((t) => {
    assert.ok(achIds[t.req], 'req が実績に無い: ' + t.id + ' -> ' + t.req);
  });
});

test('称号名/説明に絵文字を使っていない（canvas フォントは絵文字非対応）', () => {
  const surrogate = /[\uD800-\uDBFF]/;
  TITLES.forEach((t) => {
    assert.ok(!surrogate.test(t.name), '絵文字が name に: ' + t.id);
    assert.ok(!surrogate.test(t.desc), '絵文字が desc に: ' + t.id);
  });
});

test('ボーナスは控えめ（atk/def ともに 0〜5 の範囲）', () => {
  TITLES.forEach((t) => {
    assert.ok(t.bonus.atk >= 0 && t.bonus.atk <= 5, 'atk 範囲外: ' + t.id);
    assert.ok(t.bonus.def >= 0 && t.bonus.def <= 5, 'def 範囲外: ' + t.id);
  });
});

// ── createNewGame ─────────────────────────────────────────────────────
test('createNewGame は title:null を持つ（最初は称号なし）', () => {
  const s = createNewGame();
  assert.strictEqual(s.title, null);
});

// ── unlockedTitles ────────────────────────────────────────────────────
test('新規ゲームでは獲得済み称号は無い', () => {
  const s = createNewGame();
  assert.deepStrictEqual(unlockedTitles(s), []);
});

test('実績を解除すると、その req を持つ称号が獲得済みになる', () => {
  const s = createNewGame();
  s.achievements = { first_win: true };
  const got = unlockedTitles(s);
  assert.ok(got.length >= 1, '少なくとも1つ獲得');
  assert.ok(got.every((t) => t.req === 'first_win'), 'first_win 連動の称号のみ');
});

// ── equipTitle ────────────────────────────────────────────────────────
test('未解除の称号は装備できない（false を返し title は変わらない）', () => {
  const s = createNewGame();          // 実績ゼロ
  const someTitle = TITLES[0].id;
  const ok = equipTitle(s, someTitle);
  assert.strictEqual(ok, false);
  assert.strictEqual(s.title, null);
});

test('解除済みの称号は装備できる（true・title がセットされる）', () => {
  const s = createNewGame();
  const t = TITLES[0];
  s.achievements = { [t.req]: true };
  const ok = equipTitle(s, t.id);
  assert.strictEqual(ok, true);
  assert.strictEqual(s.title, t.id);
});

test('id に null を渡すと称号を外せる（true・title が null）', () => {
  const s = createNewGame();
  const t = TITLES[0];
  s.achievements = { [t.req]: true };
  equipTitle(s, t.id);
  const ok = equipTitle(s, null);
  assert.strictEqual(ok, true);
  assert.strictEqual(s.title, null);
});

test('存在しない称号 id は装備できない', () => {
  const s = createNewGame();
  s.achievements = { first_win: true };
  const ok = equipTitle(s, '__no_such_title__');
  assert.strictEqual(ok, false);
});

// ── titleBonus ────────────────────────────────────────────────────────
test('称号未装備なら bonus はゼロ', () => {
  const s = createNewGame();
  assert.deepStrictEqual(titleBonus(s), { atk: 0, def: 0 });
});

test('装備中の称号のボーナスが返る', () => {
  const s = createNewGame();
  const t = TITLES[0];
  s.achievements = { [t.req]: true };
  equipTitle(s, t.id);
  assert.deepStrictEqual(titleBonus(s), { atk: t.bonus.atk, def: t.bonus.def });
});

test('装備していても実績が未解除なら効果ゼロ（保険）', () => {
  const s = createNewGame();
  const t = TITLES[0];
  // 解除→装備→実績を消す（直接代入の不正状態でも効果を出さない）
  s.achievements = { [t.req]: true };
  equipTitle(s, t.id);
  s.achievements = {};
  assert.deepStrictEqual(titleBonus(s), { atk: 0, def: 0 });
});
