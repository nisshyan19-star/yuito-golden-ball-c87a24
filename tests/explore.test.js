// === explore.test.js（弾3：探索＝隠し通路/宝/仕掛け＋やりこみ＝図鑑/隠しボス） ===
const test   = require('node:test');
const assert = require('node:assert');
const { MAPS, TILE_LEGEND } = require('../src/data/maps.js');
const { ENEMIES } = require('../src/data/enemies.js');
const { ITEMS }   = require('../src/data/items.js');
const { createNewGame } = require('../src/core/game-state.js');
const { grantReward } = require('../src/data/story.js');

// ── 隠しボス：ファントム・ストライカー ───────────────────────────────────
test('phantom_striker が ENEMIES に存在しボス扱い', () => {
  const e = ENEMIES.phantom_striker;
  assert.ok(e, 'phantom_striker が無い');
  assert.strictEqual(e.isBoss, true);
});

test('phantom_striker は 2段階フェーズを持つ', () => {
  const e = ENEMIES.phantom_striker;
  assert.ok(Array.isArray(e.phases), 'phases が配列でない');
  assert.ok(e.phases.length >= 2, 'フェーズが2段ない');
  // 2段目は hpRatio で発動し、ステータスが上がる
  const p2 = e.phases[1];
  assert.ok(typeof p2.hpRatio === 'number', '2段目に hpRatio が無い');
  assert.ok(p2.atk > e.phases[0].atk, '2段目で こうげき が上がっていない');
});

// ── 隠しボス報酬：まぼろしのスパイク ─────────────────────────────────────
test('phantom_cleats が ITEMS に存在し武器である', () => {
  const it = ITEMS.phantom_cleats;
  assert.ok(it, 'phantom_cleats が無い');
  assert.strictEqual(it.kind, 'weapon');
  assert.ok(it.atk >= 20, 'こうげき が弱すぎる（隠しボス報酬）');
});

// ── 隠し通路タイル：H（見た目は壁・歩ける・secret） ──────────────────────
test("TILE_LEGEND['H'] は歩けて secret フラグを持つ", () => {
  const h = TILE_LEGEND['H'];
  assert.ok(h, 'H タイルが無い');
  assert.strictEqual(h.walkable, true, 'H が歩けない');
  assert.strictEqual(h.secret, true, 'H が secret でない');
  // 見た目は壁と同じスプライト（隠し通路として成立）
  assert.strictEqual(h.sprite, TILE_LEGEND['#'].sprite, 'H が壁と同じ見た目でない');
});

// ── field6（ダークアリーナ）の整合性 ─────────────────────────────────────
test('field6 グリッドは全行16文字・18行のまま', () => {
  const g = MAPS.field6.grid;
  assert.strictEqual(g.length, 18, 'field6 の行数');
  g.forEach((row, r) => assert.strictEqual(row.length, 16, 'field6 r' + r + ' の文字数'));
});

test('field6 の exits は ちょうせんの間ゲートのみ（追加弾4-D）', () => {
  // ストーリー上は最終マップ。ラスボス撃破後に ひらく「ちょうせんの間」への
  // とびらだけが ある（boss_kaiser でゲート）。
  const exits = MAPS.field6.exits;
  assert.strictEqual(exits.length, 1, 'とびらは1つ');
  assert.strictEqual(exits[0].to, 'challenge_room');
  assert.strictEqual(exits[0].requireFlag, 'boss_kaiser');
});

test('field6 に H かくし通路が1つある', () => {
  const g = MAPS.field6.grid;
  let n = 0;
  g.forEach((row) => { for (const ch of row) if (ch === 'H') n++; });
  assert.strictEqual(n, 1, 'H かくし通路の数');
});

test('field6 に隠しボス(phantom_striker)NPCがいて報酬付き', () => {
  const npcs = MAPS.field6.npcs || [];
  const boss = npcs.find((nn) => nn.boss && (nn.boss.enemies || []).includes('phantom_striker'));
  assert.ok(boss, '隠しボスNPCが無い');
  assert.ok(boss.boss.reward, '隠しボスに報酬が無い');
  assert.strictEqual(boss.boss.reward.item, 'phantom_cleats');
});

test('field6 に スイッチ(lever)NPCがある', () => {
  const npcs = MAPS.field6.npcs || [];
  const lever = npcs.find((nn) => nn.lever && nn.lever.flag === 'lever_field6');
  assert.ok(lever, 'スイッチNPCが無い');
  assert.ok(Array.isArray(lever.lever.onPages), 'onPages が無い');
});

test('field6 に スイッチで開く 仕掛け錠つき宝箱がある', () => {
  const chests = MAPS.field6.chests || [];
  const locked = chests.find((c) => c.requireFlag === 'lever_field6');
  assert.ok(locked, '仕掛け錠つき宝箱が無い');
  assert.ok(locked.lockedMsg, 'ロック時メッセージが無い');
  // スイッチのフラグと宝箱の requireFlag が一致
  const npcs = MAPS.field6.npcs || [];
  const lever = npcs.find((nn) => nn.lever);
  assert.strictEqual(locked.requireFlag, lever.lever.flag, 'スイッチと宝箱のフラグ不一致');
});

test('field6 のNPC・宝箱は歩ける地面の上にある', () => {
  const m = MAPS.field6, g = m.grid;
  (m.npcs || []).forEach((nn) => {
    const t = TILE_LEGEND[g[nn.y][nn.x]];
    assert.ok(t && t.walkable, 'NPC(' + nn.x + ',' + nn.y + ') が歩けない地面');
  });
  (m.chests || []).forEach((c) => {
    const t = TILE_LEGEND[g[c.y][c.x]];
    assert.ok(t && t.walkable, '宝箱(' + c.x + ',' + c.y + ') が歩けない地面');
  });
});

// ── 図鑑（モンスターずかん）の土台：dex ──────────────────────────────────
test('createNewGame は dex（図鑑）を空オブジェクトで持つ', () => {
  const s = createNewGame();
  assert.ok(s.dex && typeof s.dex === 'object', 'dex が無い');
  assert.strictEqual(Object.keys(s.dex).length, 0, '最初の dex は空のはず');
});

// ── 隠しボス報酬の受け渡し（grantReward が道具を渡す） ────────────────────
test('grantReward で まぼろしのスパイク を受け取れる', () => {
  const s = { gold: 0, inventory: {} };
  const msg = grantReward(s, { item: 'phantom_cleats', amount: 1, label: 'まぼろしのスパイク' });
  assert.strictEqual(s.inventory.phantom_cleats, 1);
  assert.match(msg, /まぼろしのスパイク/);
});
