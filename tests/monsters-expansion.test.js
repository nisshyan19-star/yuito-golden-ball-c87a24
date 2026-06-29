// === monsters-expansion.test.js（追加弾1：新モンスター＋レアモンスター） ===
// 新ザコ7体＋レア2体のデータ整合性、出現プール参照の妥当性、生成、
// 高防御レアでもダメージ式で必ず倒せること（最低1保証）を検証する。
const test   = require('node:test');
const assert = require('node:assert');
const { ENEMIES } = require('../src/data/enemies.js');
const { MAPS }    = require('../src/data/maps.js');
const { spawnEnemies } = require('../src/scenes/battle-scene.js');
const { calcDamage, typeMultiplier } = require('../src/logic/battle.js');

const NEW_ZAKO = [
  'mud_slime', 'corner_crow', 'throwin_golem',
  'losstime_ghost', 'trick_fox', 'stamina_zombie', 'pk_punisher',
];
const RARE = ['golden_ball', 'metal_keeper'];

// ── 新ザコ：必須フィールドと妥当な値域 ────────────────────────────────
test('新ザコ7体が ENEMIES に正しい形で定義されている', () => {
  NEW_ZAKO.forEach((id) => {
    const e = ENEMIES[id];
    assert.ok(e, id + ' が無い');
    assert.strictEqual(e.id, id, id + ' の id 不一致');
    assert.ok(['power', 'speed', 'technique'].includes(e.type), id + ' の type が不正: ' + e.type);
    ['hp', 'atk', 'def', 'spd', 'exp', 'gold'].forEach((k) => {
      assert.ok(typeof e[k] === 'number' && e[k] > 0, id + ' の ' + k + ' が不正');
    });
    assert.ok(!e.isBoss, id + ' はザコなので isBoss であってはならない');
  });
});

test('新ザコにも3タイプがすべて含まれている（相性が活きる）', () => {
  const types = new Set(NEW_ZAKO.map((id) => ENEMIES[id].type));
  ['power', 'speed', 'technique'].forEach((t) => {
    assert.ok(types.has(t), '新ザコに type=' + t + ' がいない');
  });
});

// ── レアモンスター：isRare＋高報酬＋高防御低HP ───────────────────────
test('レア2体が isRare＝true で高報酬に設定されている', () => {
  RARE.forEach((id) => {
    const e = ENEMIES[id];
    assert.ok(e, id + ' が無い');
    assert.strictEqual(e.isRare, true, id + ' に isRare:true が無い');
    assert.ok(e.exp >= 100, id + ' の exp が高報酬になっていない: ' + e.exp);
    assert.ok(e.gold >= 80, id + ' の gold が高報酬になっていない: ' + e.gold);
    assert.ok(e.def >= 18, id + ' の def が高防御になっていない: ' + e.def);
    assert.ok(e.hp <= 20, id + ' の hp が低HP（短期決戦）になっていない: ' + e.hp);
  });
});

// ── 出現プール参照の妥当性：maps.js が参照する敵idはすべて実在する ──────
test('全フィールドの encounter.enemies / rare.enemies が実在する敵idを参照している', () => {
  Object.keys(MAPS).forEach((mapId) => {
    const enc = MAPS[mapId].encounter;
    if (!enc) return;
    (enc.enemies || []).forEach((id) => {
      assert.ok(ENEMIES[id], mapId + ' の通常プールに未定義の敵id: ' + id);
    });
    if (enc.rare) {
      assert.ok(typeof enc.rare.rate === 'number' && enc.rare.rate > 0, mapId + ' の rare.rate が不正');
      assert.ok(Array.isArray(enc.rare.enemies) && enc.rare.enemies.length, mapId + ' の rare.enemies が空');
      enc.rare.enemies.forEach((id) => {
        assert.ok(ENEMIES[id], mapId + ' のレアプールに未定義の敵id: ' + id);
        assert.strictEqual(ENEMIES[id].isRare, true, mapId + ' のレアプールに非レアが混入: ' + id);
      });
    }
  });
});

test('新ザコがいずれかのフィールドの通常プールに配置されている', () => {
  const allPooled = new Set();
  Object.keys(MAPS).forEach((mapId) => {
    const enc = MAPS[mapId].encounter;
    if (enc && enc.enemies) enc.enemies.forEach((id) => allPooled.add(id));
  });
  NEW_ZAKO.forEach((id) => {
    assert.ok(allPooled.has(id), id + ' がどのフィールドにも出現しない');
  });
});

test('レアモンスターがいずれかのフィールドのレアプールに配置されている', () => {
  const allRare = new Set();
  Object.keys(MAPS).forEach((mapId) => {
    const enc = MAPS[mapId].encounter;
    if (enc && enc.rare && enc.rare.enemies) enc.rare.enemies.forEach((id) => allRare.add(id));
  });
  RARE.forEach((id) => {
    assert.ok(allRare.has(id), id + ' がどのフィールドのレア枠にもいない');
  });
});

// ── 生成：spawnEnemies が新モンスターのインスタンスを作れる ────────────
test('spawnEnemies で新モンスターのインスタンスを生成できる', () => {
  NEW_ZAKO.concat(RARE).forEach((id) => {
    const rng = {
      next: () => 0.5, rangeInt: () => 1, chance: () => false, pick: () => id,
    };
    const list = spawnEnemies([id], rng);
    assert.strictEqual(list.length, 1, id + ' の生成数が1でない');
    assert.strictEqual(list[0].baseId, id, id + ' の baseId 不一致');
    assert.strictEqual(list[0].hp, ENEMIES[id].hp, id + ' の hp 不一致');
  });
});

// ── バランス：高防御レアでも calcDamage は最低1を返す（必ず倒せる） ──────
test('高防御のレアモンスターでもダメージは最低1（詰まない）', () => {
  RARE.forEach((id) => {
    const e = ENEMIES[id];
    // 序盤の弱い攻撃でも 1 以上、つまり必ず削れる
    const dmg = calcDamage({ atk: 6 }, { def: e.def }, { power: 1 });
    assert.ok(dmg >= 1, id + ' に最低ダメージが入らない');
  });
});

// ── タイプ相性：新タイプの並びが既存3すくみに従う（回帰防止の念のため） ──
test('タイプ相性は3すくみのまま（power→technique→speed→power）', () => {
  assert.strictEqual(typeMultiplier('power', 'technique'), 1.5);
  assert.strictEqual(typeMultiplier('technique', 'speed'), 1.5);
  assert.strictEqual(typeMultiplier('speed', 'power'), 1.5);
  assert.strictEqual(typeMultiplier('power', 'speed'), 0.75);
});
