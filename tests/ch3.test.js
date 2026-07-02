'use strict';
const test = require('node:test');
const assert = require('node:assert');
const story = require('../src/data/story.js');
const MAPS = require('../src/data/maps.js').MAPS || require('../src/data/maps.js');
const itemsMod = require('../src/data/items.js');
const ITEMS = itemsMod.ITEMS || itemsMod;

// 第2章まで全クリアの土台フラグ
const CH2_DONE = {
  joined_ikuma: true, joined_aoshi: true, joined_tomoki: true, joined_itsuki: true,
  boss_magma: true, boss_guardian: true, boss_kaiser: true,
  boss_dark_general: true, boss_ice: true, boss_forest: true, boss_neo_kaiser: true,
};

test('ch3: ネオ撃破直後の目標は 世界大会 予選', () => {
  const o = story.objectiveFor(CH2_DONE);
  assert.strictEqual(o.done, false);
  assert.ok(o.bar.includes('予選') || o.bar.includes('世界大会'), 'bar: ' + o.bar);
});

test('ch3: 予選突破後の目標は 準々決勝', () => {
  const o = story.objectiveFor(Object.assign({}, CH2_DONE, { wc_qualify: true }));
  assert.ok(o.bar.includes('じゅんじゅん'), 'bar: ' + o.bar);
});

test('ch3: ゼロス撃破後の目標は 神殿 試練1', () => {
  const o = story.objectiveFor(Object.assign({}, CH2_DONE, {
    wc_qualify: true, wc_quarter: true, wc_semi: true, boss_volg: true,
    nebula_f1: true, nebula_f2: true, nebula_f3: true, boss_zeros: true,
  }));
  assert.ok(o.bar.includes('しんでん') || o.bar.includes('試練') || o.bar.includes('しれん'), 'bar: ' + o.bar);
});

test('ch3: アステリオンまで全達成で done=true', () => {
  const o = story.objectiveFor(Object.assign({}, CH2_DONE, {
    wc_qualify: true, wc_quarter: true, wc_semi: true, boss_volg: true,
    nebula_f1: true, nebula_f2: true, nebula_f3: true, boss_zeros: true,
    trial_1: true, trial_2: true, trial_3: true, boss_asterion: true,
  }));
  assert.strictEqual(o.done, true);
  assert.ok(o.bar.includes('クリア'), 'bar: ' + o.bar);
});

test('ch3: ネオ・カイザー戦は ending を発火しない（地続き突入）', () => {
  const castle = MAPS.ch2_castle;
  assert.ok(castle, 'ch2_castle が存在する');
  const bossNpc = (castle.npcs || []).find((n) => n.boss && n.boss.enemies && n.boss.enemies.includes('neo_kaiser'));
  assert.ok(bossNpc, 'neo_kaiser ボスNPCが存在する');
  assert.ok(!bossNpc.boss.ending, 'neo_kaiser撃破で ending:true を出さない');
  assert.strictEqual(bossNpc.boss.winFlag, 'boss_neo_kaiser');
});

test('ch3: ネオ撃破後 wc_stadium へ誘導する warp/exit がある', () => {
  const castle = MAPS.ch2_castle;
  const goesToStadium =
    (castle.exits || []).some((e) => e.to === 'wc_stadium') ||
    (castle.warps || []).some((w) => w.to === 'wc_stadium') ||
    (castle.npcs || []).some((n) => n.boss && n.boss.warpTo === 'wc_stadium');
  assert.ok(goesToStadium, 'wc_stadium への遷移口がある');
});

test('ch3: ネオ撃破で ch3_start フラグを立てる', () => {
  const castle = MAPS.ch2_castle;
  const bossNpc = (castle.npcs || []).find((n) => n.boss && n.boss.enemies && n.boss.enemies.includes('neo_kaiser'));
  assert.strictEqual(bossNpc.boss.setFlag, 'ch3_start');
});

test('ch3-S1: wc_stadium の決勝NPCは wc_semi を要求し ネビュラ号へワープ', () => {
  const st = MAPS.wc_stadium;
  assert.ok(st, 'wc_stadium が存在する');
  const finalNpc = (st.npcs || []).find((n) => n.boss && n.boss.enemies.includes('volg'));
  assert.ok(finalNpc, '決勝(ヴォルグ)NPCがある');
  assert.strictEqual(finalNpc.requireFlag, 'wc_semi');
  assert.strictEqual(finalNpc.boss.winFlag, 'boss_volg');
  assert.strictEqual(finalNpc.boss.warpTo, 'nebula_f1');
});

test('ch3-S1: wc_stadium は 予選→準々→準決 の順に requireFlag で一本道', () => {
  const st = MAPS.wc_stadium;
  const q = (st.npcs || []).find((n) => n.boss && n.boss.winFlag === 'wc_quarter');
  const s = (st.npcs || []).find((n) => n.boss && n.boss.winFlag === 'wc_semi');
  assert.strictEqual(q.requireFlag, 'wc_qualify', '準々は予選突破を要求');
  assert.strictEqual(s.requireFlag, 'wc_quarter', '準決は準々突破を要求');
});

test('ch3-S2: nebula 各フロアの前進出口は直前フラグを要求する', () => {
  const f1 = MAPS.nebula_f1, f2 = MAPS.nebula_f2, f3 = MAPS.nebula_f3;
  assert.ok(f1 && f2 && f3, '3フロアが存在する');
  const up1 = (f1.exits || []).find((e) => e.to === 'nebula_f2');
  const up2 = (f2.exits || []).find((e) => e.to === 'nebula_f3');
  assert.strictEqual(up1.requireFlag, 'nebula_f1');
  assert.strictEqual(up2.requireFlag, 'nebula_f2');
});

test('ch3-S2: ゼロス撃破で star_boots を報酬に、star_shrine_1 へ誘導', () => {
  const f3 = MAPS.nebula_f3;
  const zerosNpc = (f3.npcs || []).find((n) => n.boss && n.boss.enemies.includes('zeros'));
  assert.ok(zerosNpc);
  assert.strictEqual(zerosNpc.requireFlag, 'nebula_f3');
  assert.strictEqual(zerosNpc.boss.reward.item, 'star_boots');
  assert.strictEqual(zerosNpc.boss.warpTo, 'star_shrine_1');
});

test('ch3: boss_asterion 達成で真エンディングが返る', () => {
  const state = {
    party: [{ id: 'yuito', name: 'ユイト' }, { id: 'ikuma', name: 'イクマ' }],
    flags: { boss_neo_kaiser: true, boss_asterion: true },
  };
  const pages = story.getEnding(state);
  assert.ok(Array.isArray(pages) && pages.length > 0);
  const text = pages.join('\n');
  assert.ok(text.includes('だい3しょう') || text.includes('アステリオン') || text.includes('しんの'),
    '真EDの文言が含まれる');
});

test('ch3-S3: star_shrine 各出口は直前試練フラグを要求する', () => {
  const s1 = MAPS.star_shrine_1, s2 = MAPS.star_shrine_2, s3 = MAPS.star_shrine_3;
  assert.ok(s1 && s2 && s3, '3フロアが存在する');
  assert.strictEqual((s1.exits || []).find((e) => e.to === 'star_shrine_2').requireFlag, 'trial_1');
  assert.strictEqual((s2.exits || []).find((e) => e.to === 'star_shrine_3').requireFlag, 'trial_2');
});

test('ch3-S3: star_mail は trial_1 解錠の宝箱にある', () => {
  const chest = (MAPS.star_shrine_2.chests || []).find((c) => c.item === 'star_mail');
  assert.ok(chest);
  assert.strictEqual(chest.requireFlag, 'trial_1');
});

test('ch3-S3: アステリオン戦は ending:true で真EDを発火し trial_3 を要求', () => {
  const boss = (MAPS.star_shrine_3.npcs || []).find((n) => n.boss && n.boss.enemies.includes('asterion'));
  assert.ok(boss);
  assert.strictEqual(boss.requireFlag, 'trial_3');
  assert.strictEqual(boss.boss.winFlag, 'boss_asterion');
  assert.strictEqual(boss.boss.ending, true);
});

test('装備: star_boots は atk40（第3章の例外）', () => {
  assert.strictEqual(ITEMS.star_boots.atk, 40);
});

test('装備: star_boots 以外の全武器は atk<=32', () => {
  for (const id in ITEMS) {
    const it = ITEMS[id];
    if (it && it.kind === 'weapon' && id !== 'star_boots') {
      assert.ok(it.atk <= 32, id + ' の atk が32超過: ' + it.atk);
    }
  }
});

test('装備: star_mail は def28', () => {
  assert.strictEqual(ITEMS.star_mail.def, 28);
});
