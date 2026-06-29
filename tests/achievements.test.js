// === achievements.test.js（追加弾3：実績システム） ===
// 実績データの形・state からの判定ロジック・checkAchievements のべき等性を検証する。
const test   = require('node:test');
const assert = require('node:assert');
const {
  createNewGame, ACHIEVEMENTS, checkAchievements,
} = require('../src/core/game-state.js');

// ── データ形 ──────────────────────────────────────────────────────────
test('ACHIEVEMENTS は {id,name,desc,check} の配列で、id は一意', () => {
  assert.ok(Array.isArray(ACHIEVEMENTS) && ACHIEVEMENTS.length >= 10);
  const ids = {};
  ACHIEVEMENTS.forEach((a) => {
    assert.ok(a.id && typeof a.id === 'string', 'id が無い');
    assert.ok(a.name && typeof a.name === 'string', 'name が無い: ' + a.id);
    assert.ok(a.desc && typeof a.desc === 'string', 'desc が無い: ' + a.id);
    assert.strictEqual(typeof a.check, 'function', 'check が関数でない: ' + a.id);
    assert.ok(!ids[a.id], 'id 重複: ' + a.id);
    ids[a.id] = true;
  });
});

test('名前/説明に絵文字を使っていない（canvas フォントは絵文字非対応）', () => {
  // サロゲートペア（絵文字の大半）が含まれていないことを確認
  const surrogate = /[\uD800-\uDBFF]/;
  ACHIEVEMENTS.forEach((a) => {
    assert.ok(!surrogate.test(a.name), '絵文字が name に: ' + a.id);
    assert.ok(!surrogate.test(a.desc), '絵文字が desc に: ' + a.id);
  });
});

// ── createNewGame ─────────────────────────────────────────────────────
test('createNewGame は achievements:{} を持つ', () => {
  const s = createNewGame();
  assert.deepStrictEqual(s.achievements, {});
});

// ── checkAchievements：基本 ───────────────────────────────────────────
test('新規ゲームでは何も解除されない', () => {
  const s = createNewGame();
  const got = checkAchievements(s);
  assert.deepStrictEqual(got, []);
  assert.deepStrictEqual(s.achievements, {});
});

test('first_win：dex に1体記録すると解除される', () => {
  const s = createNewGame();
  s.dex = { offside_ghost: 1 };
  const got = checkAchievements(s);
  const ids = got.map((a) => a.id);
  assert.ok(ids.includes('first_win'), 'first_win が解除されていない');
  assert.strictEqual(s.achievements.first_win, true);
});

test('べき等：2回目の呼び出しでは [] を返す（同じ実績を再通知しない）', () => {
  const s = createNewGame();
  s.dex = { offside_ghost: 1 };
  const first = checkAchievements(s);
  assert.ok(first.length >= 1);
  const second = checkAchievements(s);
  assert.deepStrictEqual(second, []);
});

test('beat_emperor：flags.boss_emperor で解除', () => {
  const s = createNewGame();
  s.flags.boss_emperor = true;
  const ids = checkAchievements(s).map((a) => a.id);
  assert.ok(ids.includes('beat_emperor'));
});

test('pk_master：flags.pk_master で解除', () => {
  const s = createNewGame();
  s.flags.pk_master = true;
  const ids = checkAchievements(s).map((a) => a.id);
  assert.ok(ids.includes('pk_master'));
});

test('secret_room：flags.secret_puzzle で解除', () => {
  const s = createNewGame();
  s.flags.secret_puzzle = true;
  const ids = checkAchievements(s).map((a) => a.id);
  assert.ok(ids.includes('secret_room'));
});

test('rich：gold 500 以上で解除', () => {
  const s = createNewGame();
  s.gold = 500;
  const ids = checkAchievements(s).map((a) => a.id);
  assert.ok(ids.includes('rich'));
});

test('rare_golden / rare_metal：dex の該当キーで解除', () => {
  const s = createNewGame();
  s.dex = { golden_ball: 1, metal_keeper: 1 };
  const ids = checkAchievements(s).map((a) => a.id);
  assert.ok(ids.includes('rare_golden'));
  assert.ok(ids.includes('rare_metal'));
});

test('dex_10：10種類記録で解除（合計でなく種類数）', () => {
  const s = createNewGame();
  s.dex = {};
  for (let i = 0; i < 9; i++) s.dex['m' + i] = 5; // 9種類×5体=45体でも未達
  assert.ok(!checkAchievements(s).map((a) => a.id).includes('dex_10'));
  s.dex.m9 = 1; // 10種類目
  assert.ok(checkAchievements(s).map((a) => a.id).includes('dex_10'));
});

test('level_15：パーティ最大Lvが15以上で解除', () => {
  const s = createNewGame();
  s.party[0].level = 15;
  const ids = checkAchievements(s).map((a) => a.id);
  assert.ok(ids.includes('level_15'));
});

test('checkAchievements(null) は [] を返す（クラッシュしない）', () => {
  assert.deepStrictEqual(checkAchievements(null), []);
});

test('achievements が無い state でも初期化して動く', () => {
  const s = createNewGame();
  delete s.achievements;
  s.gold = 999;
  const ids = checkAchievements(s).map((a) => a.id);
  assert.ok(ids.includes('rich'));
  assert.strictEqual(s.achievements.rich, true);
});
