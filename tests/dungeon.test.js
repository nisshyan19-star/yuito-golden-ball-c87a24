// === dungeon.test.js（追加弾3：隠しダンジョン legend_arena） ===
// クリア後やりこみ用の「でんせつのアリーナ」＋専用ボス ゴールド・エンペラー＋
// ごほうび装備＋報酬チェスト（要フラグ解錠）の一式が正しく繋がっているか検証。
const test   = require('node:test');
const assert = require('node:assert');
const { MAPS } = require('../src/data/maps.js');
const { ENEMIES } = require('../src/data/enemies.js');
const { ITEMS } = require('../src/data/items.js');

test('legend_arena マップが存在し、暗闇ではなく到達可能な構造である', () => {
  const m = MAPS.legend_arena;
  assert.ok(m, 'legend_arena が無い');
  assert.strictEqual(m.grid.length, 18, 'グリッドが18行でない');
  m.grid.forEach((row, i) => assert.strictEqual(row.length, 16, i + '行目が16列でない'));
});

test('専用ボス gold_emperor が全ボス中 最強ステータスである', () => {
  const e = ENEMIES.gold_emperor;
  assert.ok(e, 'gold_emperor が無い');
  assert.ok(e.isBoss, 'isBoss でない');
  assert.ok(Array.isArray(e.phases) && e.phases.length === 2, '2段階構成でない');
  assert.ok(e.quotes && e.quotes.intro && e.quotes.phase && e.quotes.defeat, 'セリフが揃っていない');
  // 既存の最強ボス phantom_striker(hp200) を超える。
  // 追加弾5（第2章）の新ボス（dark_general/neo_kaiser）は別章の物語ボスなので、
  // やりこみ用 隠しボスの「最強」判定からは除外する。
  const CH2_BOSSES = ['dark_general', 'neo_kaiser'];
  const bosses = Object.values(ENEMIES).filter((x) => x.isBoss);
  const maxOther = Math.max(...bosses
    .filter((x) => x.id !== 'gold_emperor' && CH2_BOSSES.indexOf(x.id) < 0)
    .map((x) => x.hp));
  assert.ok(e.hp > maxOther, 'gold_emperor が最強HPでない: ' + e.hp + ' <= ' + maxOther);
  assert.ok(e.exp >= 400 && e.gold >= 500, '報酬が控えめすぎる');
});

test('ごほうび装備（こうていのブーツ／おうごんのよろい）が最強級で存在', () => {
  const boots = ITEMS.emperor_boots;
  const armor = ITEMS.emperor_armor;
  assert.ok(boots && boots.kind === 'weapon', 'emperor_boots が武器で無い');
  assert.ok(armor && armor.kind === 'armor', 'emperor_armor が防具で無い');
  // 既存最強 phantom_cleats(atk20) / uni3(def14) を超える
  assert.ok(boots.atk > ITEMS.phantom_cleats.atk, 'ブーツが最強攻撃でない');
  assert.ok(armor.def > ITEMS.uni3.def, 'よろいが最強防御でない');
});

test('ボスNPCが gold_emperor を呼び出し、勝利フラグ＋ブーツ報酬を与える', () => {
  const m = MAPS.legend_arena;
  const bossNpc = m.npcs.find((n) => n.boss);
  assert.ok(bossNpc, 'ボスNPCが無い');
  const b = bossNpc.boss;
  assert.ok(b.enemies.includes('gold_emperor'), '出現する敵が gold_emperor でない');
  assert.strictEqual(b.winFlag, 'boss_emperor', 'winFlag が boss_emperor でない');
  assert.ok(b.reward && b.reward.item === 'emperor_boots', '報酬がブーツでない');
});

test('報酬チェストはボス撃破フラグ(boss_emperor)で解錠され、よろいを与える', () => {
  const m = MAPS.legend_arena;
  const chest = m.chests.find((c) => c.item === 'emperor_armor');
  assert.ok(chest, 'よろいチェストが無い');
  assert.strictEqual(chest.requireFlag, 'boss_emperor', 'requireFlag が boss_emperor でない');
  assert.ok(chest.lockedMsg, 'lockedMsg（施錠メッセージ）が無い');
});

test('town3 から legend_arena へ入口ワープがあり、アリーナから戻れる', () => {
  const town3 = MAPS.town3;
  const into = (town3.warps || []).find((w) => w.to === 'legend_arena');
  assert.ok(into, 'town3 → legend_arena の入口ワープが無い');
  // 入口先（アリーナ到着点）が踏める床であること
  const dest = MAPS.legend_arena.grid[into.ty][into.tx];
  assert.ok(dest === 'F' || dest === '.' || dest === ',', '到着点が床でない: ' + dest);
  // 帰りワープ
  const back = (MAPS.legend_arena.warps || []).find((w) => w.to === 'town3');
  assert.ok(back, 'legend_arena → town3 の帰りワープが無い');
});
