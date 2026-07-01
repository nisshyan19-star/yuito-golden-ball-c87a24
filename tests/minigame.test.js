// === minigame.test.js（機能③：サッカーミニゲーム拡充 リフティング／まとあて） ===
//   純粋判定（liftingJudge / liftingSpeed / liftingWin / nextTargetZone / shootHit / shootWin）と
//   NPC配線（town2 の リフティングコーチ／まとあてコーチ）と
//   シーン状態機械（createLiftingScene / createShootScene）を検証する。
const test   = require('node:test');
const assert = require('node:assert');
const {
  liftingJudge, liftingSpeed, liftingWin,
  nextTargetZone, shootHit, shootWin,
} = require('../src/logic/battle.js');
const { MAPS } = require('../src/data/maps.js');
const { ITEMS } = require('../src/data/items.js');
const field = require('../src/scenes/field-scene.js');

// ── 1. リフティング 純粋判定 ─────────────────────────────────────────
test('liftingJudge：まんなか(0.5)は perfect', () => {
  assert.strictEqual(liftingJudge(0.5), 'perfect');
  assert.strictEqual(liftingJudge(0.45), 'perfect'); // |d|=0.05 ≤ 0.12
  assert.strictEqual(liftingJudge(0.62), 'perfect'); // |d|=0.12 ちょうど
});
test('liftingJudge：すこし ずれると good、大きく ずれると miss', () => {
  assert.strictEqual(liftingJudge(0.7), 'good');  // |d|=0.20
  assert.strictEqual(liftingJudge(0.25), 'good'); // |d|=0.25
  assert.strictEqual(liftingJudge(0.05), 'miss'); // |d|=0.45
  assert.strictEqual(liftingJudge(1.0), 'miss');  // |d|=0.50
});
test('liftingJudge：null/未指定でも 例外を出さない', () => {
  assert.strictEqual(liftingJudge(), 'miss');
  assert.strictEqual(liftingJudge(null), 'miss');
});

test('liftingSpeed：count が ふえるほど はやくなる（単調増加）', () => {
  const s0 = liftingSpeed(0);
  const s5 = liftingSpeed(5);
  const s10 = liftingSpeed(10);
  assert.ok(s0 > 0, '0でも正の速度');
  assert.ok(s5 > s0, 'count5>count0');
  assert.ok(s10 > s5, 'count10>count5');
});

test('liftingWin：目標回数 以上で 勝ち', () => {
  assert.strictEqual(liftingWin(15, 15), true);
  assert.strictEqual(liftingWin(16, 15), true);
  assert.strictEqual(liftingWin(14, 15), false);
  assert.strictEqual(liftingWin(0, 15), false);
});

// ── 2. まとあて 純粋判定 ─────────────────────────────────────────────
test('nextTargetZone：0〜8 の範囲で えらぶ', () => {
  for (let i = 0; i <= 10; i++) {
    const z = nextTargetZone(() => i / 11, null, 9);
    assert.ok(z >= 0 && z <= 8, 'ゾーンが範囲外: ' + z);
  }
});
test('nextTargetZone：avoid と 同じゾーンは えらばない', () => {
  // rng を 0 に固定→本来ゾーン0。avoid=0 なら 1 へ ずれる。
  assert.strictEqual(nextTargetZone(() => 0, 0, 9), 1);
  // avoid=8, rng で ゾーン8 を引いても 0 へ回る
  assert.strictEqual(nextTargetZone(() => 0.999, 8, 9), 0);
});
test('nextTargetZone：rng===1 の 保険で 範囲外にならない', () => {
  assert.strictEqual(nextTargetZone(() => 1, null, 9), 8);
});

test('shootHit：カーソルと 的が 同じなら ヒット', () => {
  assert.strictEqual(shootHit(4, 4), true);
  assert.strictEqual(shootHit(0, 8), false);
});
test('shootWin：ヒット数が 目標 以上で 勝ち', () => {
  assert.strictEqual(shootWin(8, 8), true);
  assert.strictEqual(shootWin(9, 8), true);
  assert.strictEqual(shootWin(7, 8), false);
});

// ── 3. NPC配線（town2） ─────────────────────────────────────────────
test('town2 に リフティングコーチ（lifting付き）があり winFlag と 報酬を持つ', () => {
  const town2 = MAPS.town2;
  const coach = (town2.npcs || []).find((n) => n.lifting);
  assert.ok(coach, 'リフティングコーチ（lifting付き）が無い');
  assert.strictEqual(coach.lifting.winFlag, 'lifting_master', 'winFlag が lifting_master でない');
  assert.ok(coach.lifting.reward && coach.lifting.reward.item, '報酬アイテムが無い');
  assert.ok(ITEMS[coach.lifting.reward.item], '報酬アイテムが items.js に無い: ' + coach.lifting.reward.item);
  const tile = town2.grid[coach.y][coach.x];
  assert.ok(tile === '.' || tile === ',' || tile === 'F', 'コーチの座標が床でない: ' + tile);
  assert.notStrictEqual(coach.x, 7, 'コーチが 道(col7)を ふさいでいる');
});
test('town2 に まとあてコーチ（shoot付き）があり winFlag と 報酬を持つ', () => {
  const town2 = MAPS.town2;
  const coach = (town2.npcs || []).find((n) => n.shoot);
  assert.ok(coach, 'まとあてコーチ（shoot付き）が無い');
  assert.strictEqual(coach.shoot.winFlag, 'shoot_master', 'winFlag が shoot_master でない');
  assert.ok(coach.shoot.reward && coach.shoot.reward.item, '報酬アイテムが無い');
  assert.ok(ITEMS[coach.shoot.reward.item], '報酬アイテムが items.js に無い: ' + coach.shoot.reward.item);
  const tile = town2.grid[coach.y][coach.x];
  assert.ok(tile === '.' || tile === ',' || tile === 'F', 'コーチの座標が床でない: ' + tile);
  assert.notStrictEqual(coach.x, 7, 'コーチが 道(col7)を ふさいでいる');
});
test('リフティングコーチと まとあてコーチは 別マスに いる', () => {
  const town2 = MAPS.town2;
  const lc = (town2.npcs || []).find((n) => n.lifting);
  const sc = (town2.npcs || []).find((n) => n.shoot);
  assert.ok(!(lc.x === sc.x && lc.y === sc.y), '2コーチが 同じマスに 重なっている');
});

// ── 4. シーン状態機械 ────────────────────────────────────────────────
function setupSRPG() {
  let popCount = 0;
  globalThis.SRPG = {
    VW: 288, VH: 512,
    liftingJudge, liftingSpeed, liftingWin,
    nextTargetZone, shootHit, shootWin,
    popScene: () => { popCount++; },
  };
  return { popped: () => popCount };
}

test('createLiftingScene：既定パラメータ（target/lives）を _debug で観測できる', () => {
  setupSRPG();
  const scene = field.createLiftingScene({ flags: {} }, {});
  const d = scene._debug();
  assert.ok(d.target > 0, 'target が正でない');
  assert.ok(d.lives > 0, 'lives が正でない');
  assert.strictEqual(d.count, 0, '開始 count が 0 でない');
  assert.strictEqual(d.phase, 'play', '開始 phase が play でない');
});

test('createLiftingScene：まんなかで タップし続ければ target 到達で 勝ち・popScene される', () => {
  const h = setupSRPG();
  // マーカーを 0.5 付近に固定するため update の dt を 0 にして pos を動かさず、
  // シーンの _forcePos があれば使う。無ければ多数回タップ（本テストは決定的手段を使う）。
  const scene = field.createLiftingScene({ flags: {} }, { target: 3, lives: 3 });
  let result = null;
  scene._onDone = null;
  // opts.onComplete で捕捉するため作り直し
  const scene2 = field.createLiftingScene({ flags: {} }, {
    target: 3, lives: 3,
    onComplete: (win, count) => { result = { win, count }; },
    _fixedPos: 0.5, // テスト用：マーカー位置を 0.5 に固定（perfect）
  });
  const press = (k) => { const p = {}; p[k] = true; return { pressed: p }; };
  // 3回 perfect タップ → count=3=target → done
  for (let i = 0; i < 3; i++) scene2.update(0.016, press('confirm'));
  // done → 閉じる
  scene2.update(0.5, press('confirm'));
  assert.ok(result, 'onComplete が呼ばれていない');
  assert.strictEqual(result.win, true, '勝ちでない: ' + JSON.stringify(result));
  assert.ok(h.popped() >= 1, 'popScene が呼ばれていない');
});

test('createLiftingScene：ミスを lives 回 かさねると 負けで 終了', () => {
  setupSRPG();
  let result = null;
  const scene = field.createLiftingScene({ flags: {} }, {
    target: 10, lives: 2,
    onComplete: (win, count) => { result = { win, count }; },
    _fixedPos: 0.0, // つねに miss
  });
  const press = (k) => { const p = {}; p[k] = true; return { pressed: p }; };
  scene.update(0.016, press('confirm')); // miss1
  scene.update(0.016, press('confirm')); // miss2 → lives 0 → done
  scene.update(0.5, press('confirm'));   // 閉じる
  assert.ok(result, 'onComplete が呼ばれていない');
  assert.strictEqual(result.win, false, '負けでない');
});

test('createShootScene：既定（target/shots/zones）を _debug で観測できる', () => {
  setupSRPG();
  const scene = field.createShootScene({ flags: {} }, {});
  const d = scene._debug();
  assert.ok(d.target > 0, 'target が正でない');
  assert.ok(d.shots > 0, 'shots が正でない');
  assert.strictEqual(d.zones, 9, 'zones が 9 でない');
  assert.strictEqual(d.hits, 0, '開始 hits が 0 でない');
});

test('createShootScene：的ゾーンへ カーソルを合わせて 撃てば ヒット→勝ち', () => {
  const h = setupSRPG();
  let result = null;
  const scene = field.createShootScene({ flags: {} }, {
    target: 2, shots: 5,
    onComplete: (win, hits) => { result = { win, hits }; },
  });
  const press = (k) => { const p = {}; p[k] = true; return { pressed: p }; };
  // カーソルは まんなか(4) から。的ゾーン(zone)は ランダムなので、
  // _debug で 現在の的ゾーンを読み、そこへ カーソルを move してから 撃つ。
  function aimAndShoot() {
    let guard = 0;
    while (scene._debug().cursor !== scene._debug().zone && guard < 40) {
      const cur = scene._debug().cursor, tgt = scene._debug().zone;
      const cr = Math.floor(cur / 3), cc = cur % 3;
      const tr = Math.floor(tgt / 3), tc = tgt % 3;
      if (cc < tc) scene.update(0.016, press('right'));
      else if (cc > tc) scene.update(0.016, press('left'));
      else if (cr < tr) scene.update(0.016, press('down'));
      else if (cr > tr) scene.update(0.016, press('up'));
      guard++;
    }
    scene.update(0.016, press('confirm')); // 撃つ
  }
  aimAndShoot();
  aimAndShoot();
  scene.update(0.5, press('confirm')); // done → 閉じる
  assert.ok(result, 'onComplete が呼ばれていない');
  assert.strictEqual(result.win, true, '勝ちでない: ' + JSON.stringify(result));
  assert.ok(h.popped() >= 1, 'popScene が呼ばれていない');
});
