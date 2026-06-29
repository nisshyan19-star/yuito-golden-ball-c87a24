// === newgame-plus.test.js（追加弾4-C：つよくてニューゲーム） ===
// createNewGamePlus（2しゅうめ いこうの ひきつぎ）と、
// newGamePlusScale（しゅうかい補正）の純粋ロジックを検証する。
// タイトルでの実選択（メニュー→確認→開始）はブラウザで非破壊目視する
// （既存方針どおり、シーンの update/draw は node では検証しない）。
const test   = require('node:test');
const assert = require('node:assert');
const GS = require('../src/core/game-state.js');
const { createNewGame, createNewGamePlus } = GS;
const { newGamePlusScale } = require('../src/scenes/battle-scene.js');

// ── テスト用：クリア済みの「やりこんだ」セーブを組み立てる ─────────────
function clearedState(over) {
  const s = createNewGame();
  // パーティを育てる（レベル/けいけんち/とくぎ/そうび/HP/MP を1しゅうめ終盤想定に）
  s.party[0].level = 20;
  s.party[0].exp   = 9999;
  s.party[0].maxHp = 200; s.party[0].hp = 37;     // 傷ついた状態
  s.party[0].maxMp = 80;  s.party[0].mp = 5;
  s.party[0].kiai  = 60;
  s.party[0].dead  = false;
  s.party[0].skills.push('overhead');
  s.party[0].equip = { weapon: 'emperor_boots', armor: 'emperor_armor' };
  // 仲間も加える（5人パーティ想定）
  s.party.push({ id: 'ikuma', name: 'イクマ', level: 18, exp: 5000, maxHp: 150, hp: 0,
                 maxMp: 40, mp: 0, kiai: 100, dead: true, skills: ['header'],
                 equip: { weapon: null, armor: null }, type: 'power' });
  s.inventory = { drink: 5, jelly: 3 };
  s.gold = 1234;
  s.flags = { boss_kaiser: true, boss_guardian: true, game_cleared: true, secret_puzzle: true };
  s.dex = { offside_ghost: 12, golden_ball: 1, dark_kaiser: 1 };
  s.achievements = { first_win: true, beat_kaiser: true, full_party: true };
  s.title = 'hero';
  s.position = { map: 'field6', x: 10, y: 3 };
  s.settings = { autoAllies: true, difficulty: 'hard' };
  return Object.assign(s, over || {});
}

// ── createNewGamePlus：ひきつぐもの ──────────────────────────────────
test('パーティのレベル/けいけんち/とくぎ/そうび/タイプを ひきつぐ', () => {
  const prev = clearedState();
  const ng = createNewGamePlus(prev);
  assert.strictEqual(ng.party.length, 2, 'なかま人数を維持');
  assert.strictEqual(ng.party[0].level, 20, 'レベル維持');
  assert.strictEqual(ng.party[0].exp, 9999, 'けいけんち維持');
  assert.deepStrictEqual(ng.party[0].skills, prev.party[0].skills, 'とくぎ維持');
  assert.deepStrictEqual(ng.party[0].equip, { weapon: 'emperor_boots', armor: 'emperor_armor' }, 'そうび維持');
  assert.strictEqual(ng.party[1].id, 'ikuma', '仲間も引き継ぐ');
});

test('もちもの/ゴールド/ずかん/じっせき/称号/せってい を ひきつぐ', () => {
  const prev = clearedState();
  const ng = createNewGamePlus(prev);
  assert.deepStrictEqual(ng.inventory, { drink: 5, jelly: 3 }, 'もちもの維持');
  assert.strictEqual(ng.gold, 1234, 'ゴールド維持');
  assert.deepStrictEqual(ng.dex, prev.dex, 'ずかん維持');
  assert.deepStrictEqual(ng.achievements, prev.achievements, 'じっせき維持');
  assert.strictEqual(ng.title, 'hero', '称号維持');
  assert.strictEqual(ng.settings.difficulty, 'hard', 'むずかしさ維持');
});

// ── createNewGamePlus：全回復して再出発 ───────────────────────────────
test('パーティは HP/MP 全回復・キアイ0・戦闘不能解除 で 出発する', () => {
  const prev = clearedState();
  const ng = createNewGamePlus(prev);
  ng.party.forEach((p) => {
    assert.strictEqual(p.hp, p.maxHp, 'HP全回復: ' + p.id);
    assert.strictEqual(p.mp, p.maxMp, 'MP全回復: ' + p.id);
    assert.strictEqual(p.kiai, 0, 'キアイ0: ' + p.id);
    assert.strictEqual(p.dead, false, '戦闘不能解除: ' + p.id);
  });
});

// ── createNewGamePlus：リセットするもの ──────────────────────────────
test('フラグは空にリセット（ストーリー/ボス/宝が はじめから）', () => {
  const ng = createNewGamePlus(clearedState());
  assert.deepStrictEqual(ng.flags, {}, 'flags が空');
});

test('いる場所は field1 のスタート位置にもどる', () => {
  const ng = createNewGamePlus(clearedState());
  assert.deepStrictEqual(ng.position, { map: 'field1', x: 5, y: 5 }, '初期位置へ');
});

// ── createNewGamePlus：しゅうかい数 ──────────────────────────────────
test('clearCount は未設定なら 1、既存なら +1 される', () => {
  const a = createNewGamePlus(clearedState());            // clearCount 未設定
  assert.strictEqual(a.clearCount, 1, '初回は1しゅうかい');
  const b = createNewGamePlus(clearedState({ clearCount: 1 }));
  assert.strictEqual(b.clearCount, 2, '2回目は2しゅうかい');
  const c = createNewGamePlus(clearedState({ clearCount: 5 }));
  assert.strictEqual(c.clearCount, 6);
});

// ── createNewGamePlus：prevState を破壊しない ─────────────────────────
test('prevState を破壊しない（ディープコピー）', () => {
  const prev = clearedState();
  const snapshot = JSON.parse(JSON.stringify(prev));
  const ng = createNewGamePlus(prev);
  // 戻り値をいじっても prev に影響しない
  ng.party[0].level = 99;
  ng.inventory.drink = 0;
  ng.flags.hacked = true;
  assert.deepStrictEqual(prev, snapshot, 'prevState が変化していない');
});

test('未定義/空オブジェクトでも落ちずに 妥当な初期構造を返す', () => {
  const a = createNewGamePlus(undefined);
  assert.ok(Array.isArray(a.party) && a.party.length >= 1, 'パーティが在る');
  assert.strictEqual(a.party[0].id, 'yuito', '最低限ユイトで開始');
  assert.strictEqual(a.clearCount, 1);
  assert.deepStrictEqual(a.flags, {});
  assert.deepStrictEqual(a.position, { map: 'field1', x: 5, y: 5 });
});

// ── newGamePlusScale：しゅうかい補正 ─────────────────────────────────
test('newGamePlusScale: 1しゅうめ(clearCount=0)は すべて等倍', () => {
  const s = newGamePlusScale(0);
  assert.deepStrictEqual(s, { enemyHp: 1, enemyAtk: 1, reward: 1 });
});

test('newGamePlusScale: しゅうかいが増えるほど 敵HP/敵攻撃/報酬が 単調増加', () => {
  const a = newGamePlusScale(1);
  const b = newGamePlusScale(2);
  assert.ok(a.enemyHp  > 1 && b.enemyHp  > a.enemyHp,  '敵HPが増える');
  assert.ok(a.enemyAtk > 1 && b.enemyAtk > a.enemyAtk, '敵攻撃が増える');
  assert.ok(a.reward   > 1 && b.reward   > a.reward,   '報酬が増える');
});

test('newGamePlusScale: 負やundefinedは 0周め扱い（等倍）で安全', () => {
  assert.deepStrictEqual(newGamePlusScale(-3), { enemyHp: 1, enemyAtk: 1, reward: 1 });
  assert.deepStrictEqual(newGamePlusScale(undefined), { enemyHp: 1, enemyAtk: 1, reward: 1 });
});

test('newGamePlusScale: 報酬の伸びが 敵HPの伸びより大きい（やりこみのご褒美）', () => {
  const s = newGamePlusScale(2);
  assert.ok(s.reward > s.enemyHp, '報酬倍率 > 敵HP倍率');
});
