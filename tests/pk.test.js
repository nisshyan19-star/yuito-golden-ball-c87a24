// === pk.test.js（追加弾3：PK戦ミニゲーム） ===
// 純粋判定 pkResolve・PKコーチNPCの配線・createPkScene の状態機械を検証する。
const test   = require('node:test');
const assert = require('node:assert');
const { pkResolve } = require('../src/logic/battle.js');
const { MAPS } = require('../src/data/maps.js');
const field = require('../src/scenes/field-scene.js');

// ── 1. 純粋判定 ──────────────────────────────────────────────────────
test('pkResolve：シュート方向とキーパーが違えばゴール、同じならセーブ', () => {
  assert.strictEqual(pkResolve('left', 'right'), true,  'ちがう方向＝ゴール');
  assert.strictEqual(pkResolve('center', 'left'), true, 'ちがう方向＝ゴール');
  assert.strictEqual(pkResolve('right', 'right'), false, '同じ方向＝セーブ');
  assert.strictEqual(pkResolve('center', 'center'), false, '同じ方向＝セーブ');
});

// ── 2. PKコーチNPCの配線（town2） ───────────────────────────────────
test('town2 に PKコーチNPC があり、勝利フラグ pk_master と報酬を持つ', () => {
  const town2 = MAPS.town2;
  const coach = (town2.npcs || []).find((n) => n.pk);
  assert.ok(coach, 'PKコーチNPC（pk付き）が無い');
  assert.strictEqual(coach.pk.winFlag, 'pk_master', 'winFlag が pk_master でない');
  assert.ok(coach.pk.reward && coach.pk.reward.item, '報酬アイテムが無い');
  // コーチの足もとが歩ける床か（配置の整合）
  const tile = town2.grid[coach.y][coach.x];
  assert.ok(tile === '.' || tile === ',' || tile === 'F', 'コーチの座標が床でない: ' + tile);
});

// ── 3. createPkScene 状態機械 ────────────────────────────────────────
// globalThis.SRPG に最小限のスタブを用意（描画は呼ばない＝update のみ検証）。
function setupSRPG() {
  let popCount = 0;
  globalThis.SRPG = {
    VW: 288, VH: 512,
    pkResolve: pkResolve,
    popScene: () => { popCount++; },
  };
  return { popped: () => popCount };
}

// scene を最後まで自動進行させ、onComplete(win, goals) を捕捉する。
// keeperDir を固定するため Math.random を一時上書きする。
function runPk(shootDir, keeperRandom, opts) {
  const orig = Math.random;
  Math.random = () => keeperRandom; // 0.1→left / 0.5→center / 0.9→right
  let result = null;
  try {
    const scene = globalThis.SRPG.createPkScene({ flags: {} }, Object.assign({
      onComplete: (win, goals) => { result = { win, goals }; },
    }, opts || {}));
    const press = (k) => { const p = {}; p[k] = true; return { pressed: p }; };
    // 中央シュートは「↑/けってい」キー（'center' という入力キーは無い）。
    const keyFor = (dir) => (dir === 'center' ? 'up' : dir);
    const dbg0 = scene._debug();
    for (let i = 0; i < dbg0.maxShots; i++) {
      // aim → kick
      scene.update(0.016, press(keyFor(shootDir)));
      // result → 次へ（タイマー満了）
      scene.update(1.2, { pressed: {} });
    }
    // done → 閉じる
    scene.update(0.5, press('confirm'));
  } finally {
    Math.random = orig;
  }
  return result;
}

test('createPkScene：全部ちがう方向に蹴れば全ゴール＝勝ち', () => {
  setupSRPG();
  globalThis.SRPG.createPkScene = field.createPkScene;
  // keeper を right(0.9) に固定し、left に蹴る → 毎回ゴール
  const r = runPk('left', 0.9);
  assert.ok(r, 'onComplete が呼ばれていない');
  assert.strictEqual(r.goals, 5, '5本ゴールでない: ' + r.goals);
  assert.strictEqual(r.win, true, '勝ちでない');
});

test('createPkScene：全部おなじ方向に蹴れば全セーブ＝負け', () => {
  setupSRPG();
  globalThis.SRPG.createPkScene = field.createPkScene;
  // keeper を left(0.1) に固定し、left に蹴る → 毎回セーブ
  const r = runPk('left', 0.1);
  assert.ok(r, 'onComplete が呼ばれていない');
  assert.strictEqual(r.goals, 0, '0ゴールでない: ' + r.goals);
  assert.strictEqual(r.win, false, '負けでない');
});

test('createPkScene：既定は5本中3本で勝ち、scene 終了で popScene される', () => {
  const h = setupSRPG();
  globalThis.SRPG.createPkScene = field.createPkScene;
  const scene = field.createPkScene({ flags: {} }, {});
  const d = scene._debug();
  assert.strictEqual(d.maxShots, 5, '既定 maxShots が5でない');
  assert.strictEqual(d.winGoals, 3, '既定 winGoals が3でない');
  // 1回プレイして popScene が呼ばれることを確認
  runPk('center', 0.9);
  assert.ok(h.popped() >= 1, 'popScene が呼ばれていない');
});
