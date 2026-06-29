const test = require('node:test'); const assert = require('node:assert');
const { forgeRecipes, rollDrops, canForge, doForge } = require('../src/logic/forge.js');
const { ITEMS } = require('../src/data/items.js');

// ── forgeRecipes ──────────────────────────────────────────────────────────────
test('forgeRecipes: 6レシピ・各 result は ITEMS に存在し materials/gold を持つ', () => {
  const recipes = forgeRecipes();
  assert.strictEqual(recipes.length, 6);
  recipes.forEach((r) => {
    assert.ok(r.id && r.result, 'id/result がある');
    assert.ok(ITEMS[r.result], r.result + ' が ITEMS に存在する');
    assert.ok(Array.isArray(r.materials) && r.materials.length, 'materials 配列');
    assert.strictEqual(typeof r.gold, 'number');
    r.materials.forEach((m) => {
      assert.ok(ITEMS[m.id], m.id + ' が ITEMS に存在する素材');
      assert.ok(m.qty > 0);
    });
  });
});

// ── rollDrops ─────────────────────────────────────────────────────────────────
test('rollDrops: chance=()=>true で全 drops の id が返る', () => {
  const enemy = { drops: [{ id: 'mat_iron', chance: 0.4 }, { id: 'mat_leather', chance: 0.4 }] };
  const got = rollDrops(enemy, { chance: () => true });
  assert.deepStrictEqual(got, ['mat_iron', 'mat_leather']);
});

test('rollDrops: chance=()=>false で [] が返る', () => {
  const enemy = { drops: [{ id: 'mat_iron', chance: 0.4 }, { id: 'mat_leather', chance: 0.4 }] };
  const got = rollDrops(enemy, { chance: () => false });
  assert.deepStrictEqual(got, []);
});

test('rollDrops: drops 未定義で []', () => {
  assert.deepStrictEqual(rollDrops({}, { chance: () => true }), []);
  assert.deepStrictEqual(rollDrops(null, { chance: () => true }), []);
});

test('rollDrops: rng 無しなら chance>=1（確定）だけ落ちる', () => {
  const enemy = { drops: [{ id: 'mat_gold', chance: 1 }, { id: 'mat_star', chance: 0.5 }] };
  const got = rollDrops(enemy);
  assert.deepStrictEqual(got, ['mat_gold']);
});

test('rollDrops: chance==null は確定扱い', () => {
  const enemy = { drops: [{ id: 'mat_gold' }] };
  assert.deepStrictEqual(rollDrops(enemy), ['mat_gold']);
});

// ── canForge ──────────────────────────────────────────────────────────────────
test('canForge: 空 inventory なら material 不足', () => {
  const state = { inventory: {}, gold: 9999 };
  const r = canForge(state, 'r_blade');
  assert.deepStrictEqual(r, { ok: false, reason: 'material' });
});

test('canForge: 素材十分だが金0なら gold 不足', () => {
  const state = { inventory: { mat_iron: 5, mat_leather: 5 }, gold: 0 };
  const r = canForge(state, 'r_blade');
  assert.deepStrictEqual(r, { ok: false, reason: 'gold' });
});

test('canForge: 素材も金も十分なら ok', () => {
  const state = { inventory: { mat_iron: 5, mat_leather: 5 }, gold: 100 };
  const r = canForge(state, 'r_blade');
  assert.strictEqual(r.ok, true);
});

test('canForge: 存在しないレシピは norecipe', () => {
  const r = canForge({ inventory: {}, gold: 0 }, 'no_such');
  assert.deepStrictEqual(r, { ok: false, reason: 'norecipe' });
});

// ── doForge ───────────────────────────────────────────────────────────────────
test('doForge: 十分なら素材と金が減り result が +1', () => {
  const state = { inventory: { mat_iron: 5, mat_leather: 5 }, gold: 100 };
  const r = doForge(state, 'r_blade');
  assert.deepStrictEqual(r, { ok: true, result: 'forged_blade' });
  assert.strictEqual(state.inventory.mat_iron, 2);   // 5 - 3
  assert.strictEqual(state.inventory.mat_leather, 3); // 5 - 2
  assert.strictEqual(state.gold, 50);                 // 100 - 50
  assert.strictEqual(state.inventory.forged_blade, 1);
});

test('doForge: 素材ちょうど0になったら delete される', () => {
  const state = { inventory: { mat_iron: 3, mat_leather: 2 }, gold: 50 };
  const r = doForge(state, 'r_blade');
  assert.strictEqual(r.ok, true);
  assert.ok(!('mat_iron' in state.inventory), 'mat_iron は消える');
  assert.ok(!('mat_leather' in state.inventory), 'mat_leather は消える');
  assert.strictEqual(state.gold, 0);
  assert.strictEqual(state.inventory.forged_blade, 1);
});

test('doForge: 素材不足なら ok:false で在庫不変', () => {
  const state = { inventory: { mat_iron: 1 }, gold: 100 };
  const r = doForge(state, 'r_blade');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'material');
  assert.strictEqual(state.inventory.mat_iron, 1); // 変わらない
  assert.strictEqual(state.gold, 100);             // 変わらない
  assert.ok(!('forged_blade' in state.inventory));
});

test('doForge: inventory 未初期化でも材料不足扱いで安全', () => {
  const state = { gold: 9999 };
  const r = doForge(state, 'r_blade');
  assert.strictEqual(r.ok, false);
});
