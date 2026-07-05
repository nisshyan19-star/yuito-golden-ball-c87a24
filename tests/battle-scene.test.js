// battle-scene の純粋ロジック（敵生成・行動順・敵AI・報酬計算）の単体テスト。
// シーンの update/draw（window/Canvas 依存）はブラウザ目視で確認する。
const test   = require('node:test');
const assert = require('node:assert');
const {
  spawnEnemies, buildTurnOrder, chooseEnemyAction, calcReward, difficultyScale,
} = require('../src/scenes/battle-scene.js');

// ── 制御可能なスタブ乱数（決定的にする） ────────────────────────────
function stubRng(opts) {
  opts = opts || {};
  return {
    next:     () => (opts.next !== undefined ? opts.next : 0.5),
    rangeInt: (a, b) => (opts.count !== undefined ? opts.count : a),
    chance:   (p) => !!opts.chance,
    pick:     (arr) => arr[(opts.pickIndex !== undefined ? opts.pickIndex : 0)],
  };
}

// ── spawnEnemies ─────────────────────────────────────────────────────

test('spawnEnemies: プールから指定数の敵インスタンスを生成する', () => {
  const rng = stubRng({ count: 2, pickIndex: 0 }); // 常に先頭(foul_goblin)を2体
  const list = spawnEnemies(['foul_goblin', 'offside_ghost'], rng);
  assert.strictEqual(list.length, 2);
  list.forEach((e) => {
    assert.strictEqual(e.baseId, 'foul_goblin');
    assert.strictEqual(e.hp, 14);
    assert.strictEqual(e.maxHp, 14);
    assert.strictEqual(e.exp, 4);
    assert.strictEqual(e.gold, 3);
    assert.strictEqual(e.dead, false);
    assert.strictEqual(e.isEnemy, true);
  });
});

test('spawnEnemies: 同じ敵が複数なら名前にA/B接尾辞を付けて区別する', () => {
  const rng = stubRng({ count: 2, pickIndex: 0 });
  const list = spawnEnemies(['foul_goblin'], rng);
  assert.strictEqual(list[0].name, 'ファウルゴブリン A');
  assert.strictEqual(list[1].name, 'ファウルゴブリン B');
});

test('spawnEnemies: インスタンスidは一意（重複しない）', () => {
  const rng = stubRng({ count: 3, pickIndex: 0 });
  const list = spawnEnemies(['foul_goblin'], rng);
  const ids = list.map((e) => e.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('spawnEnemies: 不正なidはプールから除外される', () => {
  const rng = stubRng({ count: 1, pickIndex: 0 });
  const list = spawnEnemies(['nope_invalid', 'offside_ghost'], rng);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].baseId, 'offside_ghost');
});

test('spawnEnemies: 空プールは空配列', () => {
  assert.deepStrictEqual(spawnEnemies([], stubRng({})), []);
  assert.deepStrictEqual(spawnEnemies(undefined, stubRng({})), []);
});

// ── buildTurnOrder ───────────────────────────────────────────────────

test('buildTurnOrder: 素早さ降順に並ぶ', () => {
  const units = [
    { id: 'slow', spd: 5 },
    { id: 'fast', spd: 11 },
    { id: 'mid',  spd: 8 },
  ];
  const order = buildTurnOrder(units).map((u) => u.id);
  assert.deepStrictEqual(order, ['fast', 'mid', 'slow']);
});

test('buildTurnOrder: 同速は入力順を保つ（安定ソート）', () => {
  const units = [
    { id: 'a', spd: 11 },
    { id: 'b', spd: 11 },
    { id: 'c', spd: 5 },
  ];
  const order = buildTurnOrder(units).map((u) => u.id);
  assert.deepStrictEqual(order, ['a', 'b', 'c']);
});

// ── chooseEnemyAction ────────────────────────────────────────────────

test('chooseEnemyAction: 生存している味方を攻撃対象に選ぶ', () => {
  const party = [
    { id: 'down', hp: 0, dead: true },
    { id: 'alive', hp: 10, maxHp: 20 },
  ];
  const act = chooseEnemyAction({ id: 'foe' }, party, stubRng({ pickIndex: 0 }));
  assert.strictEqual(act.type, 'attack');
  assert.strictEqual(act.targetId, 'alive'); // 倒れている down は選ばれない
});

test('chooseEnemyAction: 全員倒れていたら targetId は null', () => {
  const party = [{ id: 'x', hp: 0, dead: true }];
  const act = chooseEnemyAction({ id: 'foe' }, party, stubRng({}));
  assert.strictEqual(act.targetId, null);
});

// ── calcReward ───────────────────────────────────────────────────────

test('calcReward: 敵全員の exp と gold を合算する', () => {
  const reward = calcReward([
    { exp: 4, gold: 3 },
    { exp: 7, gold: 5 },
  ]);
  assert.deepStrictEqual(reward, { exp: 11, gold: 8 });
});

test('calcReward: 空配列は 0', () => {
  assert.deepStrictEqual(calcReward([]), { exp: 0, gold: 0 });
});

// ── difficultyScale ──────────────────────────────────────────────────

// ★2026-07-05 難易度ラダー底上げ：げんちゃん「今のむずかしいを やさしいの基準に」。
//   全難易度で敵を強化（プレイヤーが簡単すぎると感じたため）。やさしい=旧むずかしい相当の
//   強さだが、全滅しても全回復で立て直せる思想（息子くんが詰まらない）は死守。
test('difficultyScale: easy は敵がしっかり手ごたえ（旧むずかしい相当）・全回復復活・報酬多め', () => {
  const s = difficultyScale('easy');
  assert.strictEqual(s.enemyHp, 1.35);   // 旧むずかしいの敵HP倍率を やさしいの基準に
  assert.strictEqual(s.enemyAtk, 1.4);   // 旧むずかしいの敵攻撃倍率
  assert.ok(s.reward > 1);
  assert.strictEqual(s.reviveHalf, false); // やさしいは全回復で立て直し（詰まらない）
});

test('difficultyScale: hard は敵が最も強く報酬多め・半分復活', () => {
  const s = difficultyScale('hard');
  assert.strictEqual(s.enemyHp, 2.0);
  assert.strictEqual(s.enemyAtk, 2.1);
  assert.ok(s.reward > 1);
  assert.strictEqual(s.reviveHalf, true);
});

test('difficultyScale: normal/未知は やさしい超え・ふつうの手ごたえ', () => {
  const n = difficultyScale('normal');
  assert.deepStrictEqual(n, { enemyHp: 1.6, enemyAtk: 1.7, reward: 1.5, reviveHalf: false });
  assert.deepStrictEqual(difficultyScale(undefined), n);
});

test('difficultyScale: 難易度が上がるほど敵が強い（easy < normal < hard）', () => {
  const e = difficultyScale('easy');
  const n = difficultyScale('normal');
  const h = difficultyScale('hard');
  assert.ok(e.enemyHp < n.enemyHp && n.enemyHp < h.enemyHp, '敵HP倍率が単調増加');
  assert.ok(e.enemyAtk < n.enemyAtk && n.enemyAtk < h.enemyAtk, '敵攻撃倍率が単調増加');
});
