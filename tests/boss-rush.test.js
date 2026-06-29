// === boss-rush.test.js（追加弾4-D：ボスラッシュ「ちょうせんの間」） ===
// ボスラッシュの データ整合性を 純粋に検証する。
//   ・challenge_room マップの 形・出入り・ワープ
//   ・field6 の ゲート付きとびら（boss_kaiser 撃破で開放）→ challenge_room
//   ・bossRush NPC の 敵が すべて ENEMIES に実在
//   ・トロフィー報酬 champion_spike が ITEMS に実在し 最強の ぶき
//   ・grantReward が champion_spike を ただしく わたす
// シーン(_startBossRush の戦闘チェーン)はブラウザで非破壊目視する
// （既存方針どおり、シーンの update/draw は node では検証しない）。
const test   = require('node:test');
const assert = require('node:assert');

const { MAPS, TILE_LEGEND } = require('../src/data/maps.js');
const { ITEMS }   = require('../src/data/items.js');
const { ENEMIES } = require('../src/data/enemies.js');
const { grantReward } = require('../src/data/story.js');
const { createNewGame } = require('../src/core/game-state.js');

// ── ヘルパ：マップ上の(x,y)が 歩けるタイルか ───────────────────────────
function isWalkable(map, x, y) {
  const row = map && map.grid && map.grid[y];
  if (!row || x < 0 || x >= row.length) return false;
  const t = TILE_LEGEND[row[x]];
  return !!(t && t.walkable);
}

// ── challenge_room マップの 形 ───────────────────────────────────────
test('challenge_room が存在し 16×18 のグリッド', () => {
  const m = MAPS.challenge_room;
  assert.ok(m, 'challenge_room が存在する');
  assert.strictEqual(m.grid.length, 18, '18行');
  m.grid.forEach((row, i) => {
    assert.strictEqual(row.length, 16, '16文字: row ' + i);
  });
});

test('challenge_room は ザコ戦なし（encounter.rate=0）', () => {
  const m = MAPS.challenge_room;
  assert.strictEqual(m.encounter.rate, 0, 'ランダムエンカウント無し');
  assert.deepStrictEqual(m.encounter.enemies, [], 'エンカウント敵プールは空');
});

// ── field6 → challenge_room の とびら（boss_kaiser ゲート） ────────────
test('field6 に boss_kaiser ゲートの とびらが あり challenge_room へつながる', () => {
  const exits = MAPS.field6.exits || [];
  const door = exits.find((e) => e.to === 'challenge_room');
  assert.ok(door, 'challenge_room へのとびらが ある');
  assert.strictEqual(door.requireFlag, 'boss_kaiser', 'ラスボス撃破フラグで ゲート');
  assert.ok(door.lockedMsg, 'ロック時メッセージが ある');
});

test('field6 → challenge_room の着地タイルが 歩ける', () => {
  const door = MAPS.field6.exits.find((e) => e.to === 'challenge_room');
  assert.ok(isWalkable(MAPS.challenge_room, door.tx, door.ty),
    'challenge_room の着地(' + door.tx + ',' + door.ty + ')が歩ける');
});

// ── challenge_room → field6 の もどりワープ ───────────────────────────
test('challenge_room の もどりワープは field6 へ戻り 着地が歩ける', () => {
  const warps = MAPS.challenge_room.warps || [];
  const back = warps.find((w) => w.to === 'field6');
  assert.ok(back, 'field6 へのワープが ある');
  assert.ok(isWalkable(MAPS.field6, back.tx, back.ty),
    'field6 の着地(' + back.tx + ',' + back.ty + ')が歩ける');
});

test('もどりワープの着地は field6 のとびら(7,16)から はなれている＝即・再突入しない', () => {
  const door = MAPS.field6.exits.find((e) => e.to === 'challenge_room');
  const back = MAPS.challenge_room.warps.find((w) => w.to === 'field6');
  // 着地がとびらの真上(7,15)だと 下を押した瞬間に 再突入してしまう。2マス以上 離す。
  const dist = Math.abs(back.ty - door.y);
  assert.ok(back.tx === door.x ? dist >= 2 : true,
    '同じ列なら とびらから2マス以上 はなす（着地ty=' + back.ty + ' とびらy=' + door.y + '）');
});

// ── ボスラッシュ NPC の 中身 ─────────────────────────────────────────
test('challenge_room に bossRush NPC が あり 敵は すべて ENEMIES に実在', () => {
  const npc = (MAPS.challenge_room.npcs || []).find((n) => n.bossRush);
  assert.ok(npc, 'bossRush を持つ NPC が いる');
  const br = npc.bossRush;
  assert.ok(Array.isArray(br.enemies) && br.enemies.length >= 2, 'ボスが2体以上');
  br.enemies.forEach((id) => {
    assert.ok(ENEMIES[id], 'ENEMIES に実在: ' + id);
  });
});

test('bossRush の winFlag と トロフィー報酬が 正しく定義', () => {
  const npc = MAPS.challenge_room.npcs.find((n) => n.bossRush);
  const br = npc.bossRush;
  assert.strictEqual(br.winFlag, 'challenge_clear', '全クリアフラグ');
  assert.ok(br.reward && br.reward.item === 'champion_spike', 'ごほうびは champion_spike');
  assert.ok(npc.pages && npc.pages.length >= 1, '開始前の セリフが ある');
  assert.ok(npc.afterPages && npc.afterPages.length >= 1, 'クリア後の セリフが ある');
});

// ── トロフィー装備 champion_spike ────────────────────────────────────
test('champion_spike が ITEMS に実在し ボスラッシュ報酬として最強の ぶき', () => {
  const w = ITEMS.champion_spike;
  assert.ok(w, 'champion_spike が存在する');
  assert.strictEqual(w.kind, 'weapon', 'ぶき');
  // 既存の最強(emperor_boots atk28)より 強い＝トロフィーらしい性能。
  // ※ 追加弾5-D の かじや合成専用 star_boots(atk40) は やりこみ報酬なので比較対象から除外する。
  const FORGED_ONLY = ['star_boots'];
  const weaponAtks = Object.values(ITEMS)
    .filter((it) => it.kind === 'weapon' && it.id !== 'champion_spike' && FORGED_ONLY.indexOf(it.id) === -1)
    .map((it) => it.atk || 0);
  assert.ok(w.atk > Math.max.apply(null, weaponAtks),
    'champion_spike(' + w.atk + ') が 合成専用そうび いがいの どの ぶきより強い');
});

// ── grantReward が champion_spike を わたす ──────────────────────────
test('grantReward で champion_spike が もちものに入る', () => {
  const s = createNewGame();
  const npc = MAPS.challenge_room.npcs.find((n) => n.bossRush);
  const before = (s.inventory && s.inventory.champion_spike) || 0;
  const summary = grantReward(s, npc.bossRush.reward);
  assert.strictEqual(s.inventory.champion_spike, before + 1, '1個もらえる');
  assert.ok(/チャンピオンシューズ/.test(summary), '表示名が summary に含まれる');
});
