// === tournament.test.js（追加弾5-C：サッカー トーナメント） ===
// 純粋ロジック（tournament.js）／シーン状態機械（tournament-scene.js）／
// NPC配線（town2）／実績・称号・報酬アイテムの配線を検証する。
const test   = require('node:test');
const assert = require('node:assert');
const T      = require('../src/logic/tournament.js');
const { pkResolve } = require('../src/logic/battle.js');
const { MAPS }  = require('../src/data/maps.js');
const { ITEMS } = require('../src/data/items.js');
const GS    = require('../src/core/game-state.js');
const field = require('../src/scenes/field-scene.js');
const tscene= require('../src/scenes/tournament-scene.js');

// ── 1. matchWinner ──
test('matchWinner：多い方の勝ち、同点は draw', () => {
  assert.strictEqual(T.matchWinner(3, 2), 'player');
  assert.strictEqual(T.matchWinner(1, 2), 'opponent');
  assert.strictEqual(T.matchWinner(2, 2), 'draw');
});

// ── 2. buildBracket ──
test('buildBracket：3チーム・skill 昇順・round ラベルあり・元データ非破壊', () => {
  const b = T.buildBracket();
  assert.strictEqual(b.length, 3);
  assert.ok(b[0].skill < b[1].skill && b[1].skill < b[2].skill, 'skill が昇順でない');
  assert.ok(b.every((t) => typeof t.round === 'string' && t.round.length > 0), 'round ラベルが無い');
  assert.notStrictEqual(b, T.TOURNAMENT_TEAMS, 'コピーでない（同一参照）');
});

// ── 3. keeperDiveFor ──
test('keeperDiveFor：rng<skill なら playerShot と同じ（セーブ）／else ランダム方向', () => {
  // skill=1.0 → 1回目の rng が何でも < 1.0 ＝ playerShot を返す
  assert.strictEqual(T.keeperDiveFor('left', 1.0, () => 0.3), 'left');
  // skill=0 → 1回目 0.9 は < 0 でない → 2回目 0.9 で DIRS[floor(0.9*3)=2]='right'
  let seq = [0.9, 0.9]; let i = 0;
  assert.strictEqual(T.keeperDiveFor('left', 0, () => seq[i++]), 'right');
});

// ── 4. opponentShotFor ──
test('opponentShotFor：rng<skill で左右のみ／else 3方向ランダム', () => {
  // skill=1.0：1回目 0.2(<1.0) → 2回目 0.2(<0.5) → 'left'
  let s1 = [0.2, 0.2]; let i1 = 0;
  assert.strictEqual(T.opponentShotFor(1.0, () => s1[i1++]), 'left');
  // skill=1.0：1回目 0.2 → 2回目 0.8(>=0.5) → 'right'
  let s2 = [0.2, 0.8]; let i2 = 0;
  assert.strictEqual(T.opponentShotFor(1.0, () => s2[i2++]), 'right');
  // skill=0：1回目 0.9 は <0 でない → DIRS[floor(0.9*3)=2]='right'
  assert.strictEqual(T.opponentShotFor(0, () => 0.9), 'right');
});

// ── 5. town2 トーナメントNPC配線 ──
test('town2 に トーナメントNPC があり winFlag/requireFlag/報酬を持つ', () => {
  const org = (MAPS.town2.npcs || []).find((n) => n.tournament);
  assert.ok(org, 'tournament NPC が無い');
  assert.strictEqual(org.tournament.winFlag, 'tournament_champion');
  assert.strictEqual(org.tournament.requireFlag, 'pk_master');
  assert.ok(org.tournament.reward && org.tournament.reward.item, '報酬アイテムが無い');
  const tile = MAPS.town2.grid[org.y][org.x];
  assert.ok(tile === '.' || tile === ',' || tile === 'F', '主催者の座標が床でない: ' + tile);
});

// ── 6. 報酬アイテム ──
test('ITEMS に champ_ball（武器）がある', () => {
  assert.ok(ITEMS.champ_ball, 'champ_ball が無い');
  assert.strictEqual(ITEMS.champ_ball.kind, 'weapon');
});

// ── 7. 実績・称号 ──
test('tournament_champion 実績が flag で解除され、champion 称号が手に入る', () => {
  const st = { flags: { tournament_champion: true }, achievements: {}, dex: {}, party: [] };
  const unlocked = GS.checkAchievements(st);
  assert.ok(unlocked.some((a) => a.id === 'tournament_champion'), '実績が解除されない');
  const titles = GS.unlockedTitles(st);
  assert.ok(titles.some((t) => t.id === 'champion'), 'champion 称号が出ない');
  assert.strictEqual(GS.equipTitle(st, 'champion'), true);
  const bonus = GS.titleBonus(st);
  assert.ok(bonus.atk >= 1 && bonus.def >= 1, '称号ボーナスが無い');
});

// ── 8. シーン状態機械：rng固定で 優勝/敗退を決定的に駆動 ──
function setupSRPG() {
  let popCount = 0;
  globalThis.SRPG = {
    VW: 288, VH: 512,
    pkResolve: pkResolve,
    buildBracket: T.buildBracket, keeperDiveFor: T.keeperDiveFor,
    opponentShotFor: T.opponentShotFor, matchWinner: T.matchWinner,
    popScene: () => { popCount++; },
  };
  return { popped: () => popCount };
}
// phase を読んで適切なキーを送る自動ドライバ。done か上限で止まる。
function drive(scene, attackKey, defendKey, maxIter) {
  const press = (k) => { const p = {}; if (k) p[k] = true; return { pressed: p }; };
  for (let i = 0; i < (maxIter || 400); i++) {
    const d = scene._debug();
    if (d.done) break;
    switch (d.phase) {
      case 'intro': case 'defend_intro': case 'round_banner':
        scene.update(0.5, press('confirm')); break;
      case 'attack_aim': case 'sd_attack_aim':
        scene.update(0.016, press(attackKey)); break;
      case 'defend_aim': case 'sd_defend_aim':
        scene.update(0.016, press(defendKey)); break;
      case 'attack_result': case 'defend_result': case 'match_done':
      case 'sd_attack_result': case 'sd_defend_result':
        scene.update(1.2, press('confirm')); break;
      case 'champion': case 'lost':
        scene.update(0.5, press('confirm')); break;
      default:
        scene.update(0.5, press('confirm')); break;
    }
  }
}
// rng=0.9 固定 → 相手キーパー/相手シューターは常に 'right'。
//   攻撃で 'left' を蹴れば毎回ゴール、守備で 'right' にとべば毎回セーブ ＝ 完封優勝。
test('createTournamentScene：左シュート＋右セーブで 全勝 優勝', () => {
  const h = setupSRPG();
  globalThis.SRPG.createTournamentScene = tscene.createTournamentScene;
  let result = null;
  const scene = tscene.createTournamentScene({ flags: {} }, {
    rng: () => 0.9,
    onComplete: (champ, won) => { result = { champ, won }; },
  });
  drive(scene, 'left', 'right');
  assert.ok(result, 'onComplete が呼ばれていない');
  assert.strictEqual(result.champ, true, '優勝になっていない');
  assert.strictEqual(result.won, 3, '3回戦突破でない: ' + result.won);
  assert.ok(h.popped() >= 1, 'popScene が呼ばれていない');
});
//   攻撃で 'right'（キーパーに止められる）＋守備で 'left'（右シュートを止められない）＝ 1回戦敗退。
test('createTournamentScene：右シュート＋左セーブで 1回戦敗退', () => {
  setupSRPG();
  globalThis.SRPG.createTournamentScene = tscene.createTournamentScene;
  let result = null;
  const scene = tscene.createTournamentScene({ flags: {} }, {
    rng: () => 0.9,
    onComplete: (champ, won) => { result = { champ, won }; },
  });
  drive(scene, 'right', 'left');
  assert.ok(result, 'onComplete が呼ばれていない');
  assert.strictEqual(result.champ, false, '敗退になっていない');
  assert.strictEqual(result.won, 0, '0回戦突破でない: ' + result.won);
});
