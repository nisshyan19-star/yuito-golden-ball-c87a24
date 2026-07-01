'use strict';
const test = require('node:test');
const assert = require('node:assert');

const story = require('../src/data/story.js');

test('objectiveFor: 何もしていない時は ほのおの どうくつ を指す', () => {
  const o = story.objectiveFor({});
  assert.ok(o.bar.includes('ほのお'), 'barに「ほのお」が含まれる: ' + o.bar);
  assert.ok(o.npc.includes('マグマ'), 'npc文にマグマが含まれる');
  assert.strictEqual(o.done, false);
});

test('objectiveFor: マグマ撃破後は スカイスタジアム(ガーディアン) を指す', () => {
  const o = story.objectiveFor({ boss_magma: true });
  assert.ok(o.bar.includes('スカイスタジアム'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('ガーディアン'));
});

test('objectiveFor: カイザー撃破後は こおりの とうげ(ヴォルク) を指す', () => {
  const o = story.objectiveFor({ boss_magma: true, boss_guardian: true, boss_kaiser: true });
  assert.ok(o.bar.includes('こおりの とうげ'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('ヴォルク'));
});

test('objectiveFor: 将軍撃破後は こおりの とう(アイスゴーレム) を指す', () => {
  const o = story.objectiveFor({
    boss_magma: true, boss_guardian: true, boss_kaiser: true, boss_dark_general: true,
  });
  assert.ok(o.bar.includes('こおりの とう'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('アイス・ゴーレム'));
});

test('objectiveFor: アイス撃破後は もりの しんでん(ガイア) を指す', () => {
  const o = story.objectiveFor({
    boss_magma: true, boss_guardian: true, boss_kaiser: true,
    boss_dark_general: true, boss_ice: true,
  });
  assert.ok(o.bar.includes('もりの しんでん'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('ガイア'));
});

test('objectiveFor: 森撃破後は やみのしろ(ネオ・カイザー) を指す', () => {
  const o = story.objectiveFor({
    boss_magma: true, boss_guardian: true, boss_kaiser: true,
    boss_dark_general: true, boss_ice: true, boss_forest: true,
  });
  assert.ok(o.bar.includes('やみのしろ'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('ネオ・カイザー'));
});

test('objectiveFor: 全部倒したら done=true', () => {
  const o = story.objectiveFor({
    boss_magma: true, boss_guardian: true, boss_kaiser: true,
    boss_dark_general: true, boss_ice: true, boss_forest: true, boss_neo_kaiser: true,
  });
  assert.strictEqual(o.done, true);
  assert.ok(o.bar.includes('クリア'));
});

const ENEMIES = require('../src/data/enemies.js').ENEMIES;
const MAPS = require('../src/data/maps.js').MAPS;

test('cave1 エンカウントは最弱敵のみ＋レアは golden_ball', () => {
  const enc = MAPS.cave1.encounter;
  const easy = ['foul_goblin', 'mud_slime', 'offside_ghost', 'corner_crow'];
  assert.deepStrictEqual(enc.enemies.slice().sort(), easy.slice().sort());
  assert.deepStrictEqual(enc.rare.enemies, ['golden_ball']);
  assert.ok(enc.rate <= 0.08, 'cave1のエンカ率は0.08以下');
  ['metal_keeper', 'pk_punisher', 'throwin_golem'].forEach((id) => {
    assert.ok(!enc.enemies.includes(id), id + ' は cave1 に出ない');
  });
});

test('炎ボス報酬は序盤相当（スピードスパイク＋こうてつガード）', () => {
  const npcs = MAPS.cave1.npcs || [];
  const bossNpc = npcs.find((n) => n.boss && n.boss.winFlag === 'boss_magma');
  assert.ok(bossNpc, '炎ボスNPCが存在');
  assert.strictEqual(bossNpc.boss.reward.item, 'spike2');
  const chest = (MAPS.cave1.chests || []).find((c) => c.id === 'cave1_chest_boss');
  assert.ok(chest, 'cave1_chest_boss が存在');
  assert.strictEqual(chest.item, 'forged_guard');
});

test('magma_golem は最弱ボス相当・単形態（難易度カーブ単調）', () => {
  const m = ENEMIES.magma_golem;
  assert.strictEqual(m.hp, 80, 'magmaのhpは80');
  assert.ok(!m.phases, 'magmaは単形態（phases無し）');
  // 単調増加：magma < guardian < dark_kaiser < dark_general < ice_golem < neo_kaiser
  const hp = (id) => ENEMIES[id].hp;
  assert.ok(hp('magma_golem') < hp('guardian'),     'magma < guardian');
  assert.ok(hp('guardian')   < hp('dark_kaiser'),   'guardian < dark_kaiser');
  assert.ok(hp('dark_kaiser')< hp('dark_general'),  'dark_kaiser < dark_general');
  assert.ok(hp('dark_general')< hp('ice_golem'),    'dark_general < ice_golem');
  assert.ok(hp('ice_golem')  < hp('neo_kaiser'),    'ice_golem < neo_kaiser');
});

function findExit(mapId, toId) {
  return (MAPS[mapId].exits || []).find((e) => e.to === toId);
}
test('ゲート1: town1→field2 は boss_magma が必要', () => {
  const e = findExit('town1', 'field2');
  assert.ok(e, 'town1→field2 出口が存在');
  assert.strictEqual(e.requireFlag, 'boss_magma');
  assert.ok(e.lockedMsg && e.lockedMsg.includes('ほのお'), 'lockedMsgが行き先を案内');
});
test('ゲート2: ch2_town→tower_ice_1f は boss_dark_general が必要', () => {
  const e = findExit('ch2_town', 'tower_ice_1f');
  assert.ok(e, 'ch2_town→tower_ice_1f 出口が存在');
  assert.strictEqual(e.requireFlag, 'boss_dark_general');
  assert.ok(e.lockedMsg && e.lockedMsg.includes('ヴォルク'), 'lockedMsgが将軍を案内');
});
test('ゲート3: ch2_pass→shrine_forest_1f は boss_ice が必要（氷の塔クリアで森が開く）', () => {
  const e = findExit('ch2_pass', 'shrine_forest_1f');
  assert.ok(e, 'ch2_pass→shrine_forest_1f 出口が存在');
  assert.strictEqual(e.requireFlag, 'boss_ice');
  assert.ok(e.lockedMsg && e.lockedMsg.includes('アイス'), 'lockedMsgがアイスゴーレムを案内');
});
test('ゲート4: shrine_forest_3f→ch2_castle は boss_forest が必要（森の守り神ガイア撃破で城が開く）', () => {
  const e = findExit('shrine_forest_3f', 'ch2_castle');
  assert.ok(e, 'shrine_forest_3f→ch2_castle 出口が存在');
  assert.strictEqual(e.requireFlag, 'boss_forest');
  assert.ok(e.lockedMsg && e.lockedMsg.includes('森'), 'lockedMsgが森の守り神を案内');
});
test('案内コーチが town1 と ch2_town に居る（guide:true・coachスプライト）', () => {
  const t1 = (MAPS.town1.npcs || []).find((n) => n.guide);
  assert.ok(t1, 'town1に案内コーチが居る');
  assert.strictEqual(t1.sprite, 'coach');
  const t2 = (MAPS.ch2_town.npcs || []).find((n) => n.guide);
  assert.ok(t2, 'ch2_townに案内コーチが居る');
  assert.strictEqual(t2.sprite, 'coach');
});
