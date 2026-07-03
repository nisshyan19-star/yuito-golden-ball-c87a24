'use strict';
const test = require('node:test');
const assert = require('node:assert');

const story = require('../src/data/story.js');

// 仲間4人 加入済み（joined_* 一式）。ボス段階のテストは全員加入前提で渡す。
const J = { joined_ikuma: true, joined_aoshi: true, joined_tomoki: true, joined_itsuki: true };

test('objectiveFor: 何もしていない時は イクマ加入 を指す', () => {
  const o = story.objectiveFor({});
  assert.ok(o.bar.includes('イクマ'), 'barに「イクマ」が含まれる: ' + o.bar);
  assert.ok(o.npc.includes('イクマ'), 'npc文にイクマが含まれる');
  assert.strictEqual(o.done, false);
});

test('objectiveFor: イクマ加入後は ほのおの どうくつ を指す', () => {
  const o = story.objectiveFor({ joined_ikuma: true, secret_puzzle: true });
  assert.ok(o.bar.includes('ほのお'), 'barに「ほのお」が含まれる: ' + o.bar);
  assert.ok(o.npc.includes('マグマ'), 'npc文にマグマが含まれる');
  assert.strictEqual(o.done, false);
});

test('objectiveFor: 4人加入＋マグマ撃破後は スカイスタジアム(ガーディアン) を指す', () => {
  const o = story.objectiveFor(Object.assign({}, J, {
    secret_puzzle: true, boss_magma: true, boss_water: true,
  }));
  assert.ok(o.bar.includes('スカイスタジアム'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('ガーディアン'));
});

test('objectiveFor: カイザー撃破後は こおりの とうげ(ヴォルク) を指す', () => {
  const o = story.objectiveFor(Object.assign({}, J, {
    secret_puzzle: true, boss_water: true, boss_emperor: true, challenge_clear: true,
    boss_magma: true, boss_guardian: true, boss_kaiser: true,
  }));
  assert.ok(o.bar.includes('こおりの とうげ'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('ヴォルク'));
});

test('objectiveFor: 将軍撃破後は こおりの とう(アイスゴーレム) を指す', () => {
  const o = story.objectiveFor(Object.assign({}, J, {
    secret_puzzle: true, boss_water: true, boss_emperor: true, challenge_clear: true,
    boss_magma: true, boss_guardian: true, boss_kaiser: true, boss_dark_general: true,
  }));
  assert.ok(o.bar.includes('こおりの とう'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('アイス・ゴーレム'));
});

test('objectiveFor: アイス撃破後は もりの しんでん(ガイア) を指す', () => {
  const o = story.objectiveFor(Object.assign({}, J, {
    secret_puzzle: true, boss_water: true, boss_emperor: true, challenge_clear: true,
    boss_magma: true, boss_guardian: true, boss_kaiser: true,
    boss_dark_general: true, boss_ice: true,
  }));
  assert.ok(o.bar.includes('もりの しんでん'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('ガイア'));
});

test('objectiveFor: 森撃破後は やみのしろ(ネオ・カイザー) を指す', () => {
  const o = story.objectiveFor(Object.assign({}, J, {
    secret_puzzle: true, boss_water: true, boss_emperor: true, challenge_clear: true,
    boss_magma: true, boss_guardian: true, boss_kaiser: true,
    boss_dark_general: true, boss_ice: true, boss_forest: true,
  }));
  assert.ok(o.bar.includes('やみのしろ'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('ネオ・カイザー'));
});

test('objectiveFor: 全部倒したら done=true', () => {
  const o = story.objectiveFor(Object.assign({}, J, {
    secret_puzzle: true, boss_water: true, boss_emperor: true, challenge_clear: true,
    boss_magma: true, boss_guardian: true, boss_kaiser: true,
    boss_dark_general: true, boss_ice: true, boss_forest: true, boss_neo_kaiser: true,
    wc_qualify: true, wc_quarter: true, wc_semi: true, boss_volg: true,
    nebula_f1: true, nebula_f2: true, nebula_f3: true, boss_zeros: true,
    trial_1: true, trial_2: true, trial_3: true, boss_asterion: true,
  }));
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

test('必須化: field1〜4 の南出口(7,16) に requireFlag/lockedMsg があり joined_* と一致する', () => {
  const cases = [
    { map: 'field1', to: 'town1',  flag: 'joined_ikuma',  joinId: 'ikuma'  },
    { map: 'field2', to: 'field3', flag: 'joined_aoshi',  joinId: 'aoshi'  },
    { map: 'field3', to: 'town2',  flag: 'joined_tomoki', joinId: 'tomoki' },
    { map: 'field4', to: 'field5', flag: 'joined_itsuki', joinId: 'itsuki' },
  ];
  cases.forEach((c) => {
    const e = (MAPS[c.map].exits || []).find((x) => x.to === c.to);
    assert.ok(e, c.map + '→' + c.to + ' 出口が存在');
    assert.strictEqual(e.requireFlag, c.flag, c.map + ' の requireFlag');
    assert.ok(e.lockedMsg && e.lockedMsg.length > 0, c.map + ' に lockedMsg');
    const npc = (MAPS[c.map].npcs || []).find((n) => n.joinId === c.joinId);
    assert.ok(npc, c.map + ' に joinId=' + c.joinId + ' のNPC');
    assert.strictEqual(e.requireFlag, 'joined_' + npc.joinId, 'requireFlag と joined_+joinId が一致');
  });
});

test('加入演出: 仲間4人に joinStory が3ページ以上ある', () => {
  const want = [
    { map: 'field1', joinId: 'ikuma'  },
    { map: 'field2', joinId: 'aoshi'  },
    { map: 'field3', joinId: 'tomoki' },
    { map: 'field4', joinId: 'itsuki' },
  ];
  want.forEach((w) => {
    const npc = (MAPS[w.map].npcs || []).find((n) => n.joinId === w.joinId);
    assert.ok(npc, w.map + ' に ' + w.joinId);
    assert.ok(Array.isArray(npc.joinStory), w.joinId + ' に joinStory 配列');
    assert.ok(npc.joinStory.length >= 3, w.joinId + ' の joinStory は3ページ以上');
    npc.joinStory.forEach((p) => assert.ok(typeof p === 'string' && p.length > 0));
  });
});

test('勝利イベント: 5マップに requireFlag=撃破フラグ の cutscenes がある', () => {
  const want = [
    { map: 'cave1',            flag: 'cs_win_magma',        req: 'boss_magma' },
    { map: 'field5',           flag: 'cs_win_guardian',     req: 'boss_guardian' },
    { map: 'ch2_pass',         flag: 'cs_win_dark_general', req: 'boss_dark_general' },
    { map: 'tower_ice_3f',     flag: 'cs_win_ice',          req: 'boss_ice' },
    { map: 'shrine_forest_3f', flag: 'cs_win_forest',       req: 'boss_forest' },
  ];
  want.forEach((w) => {
    const list = MAPS[w.map].cutscenes || (MAPS[w.map].cutscene ? [MAPS[w.map].cutscene] : []);
    const cs = list.find((c) => c.flag === w.flag);
    assert.ok(cs, w.map + ' に ' + w.flag);
    assert.strictEqual(cs.requireFlag, w.req, w.map + ' の requireFlag');
    assert.ok(cs.pages && cs.pages.length >= 2, w.map + ' の pages が2枚以上');
  });
});

test('章転換: field6 に cs_after_ch1(requireFlag=boss_kaiser)、ch2_gate に章タイトルコール', () => {
  const f6 = MAPS.field6.cutscenes || (MAPS.field6.cutscene ? [MAPS.field6.cutscene] : []);
  const intro = f6.find((c) => c.flag === 'cs_field6');
  assert.ok(intro, 'field6 の入場 cs_field6 は維持');
  const after = f6.find((c) => c.flag === 'cs_after_ch1');
  assert.ok(after, 'field6 に cs_after_ch1');
  assert.strictEqual(after.requireFlag, 'boss_kaiser');
  assert.ok(after.pages.length >= 2);

  const gate = MAPS.ch2_gate.cutscene;
  assert.ok(gate && gate.pages.some((p) => p.includes('だい2しょう')), 'ch2_gate に章タイトルコール');
});
