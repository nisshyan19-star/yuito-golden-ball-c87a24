const test=require('node:test'); const assert=require('node:assert');
const { maxParty, enemyToCharacter, canScout, scoutChance, addToRoster, swapInMonster, sendToRoster } = require('../src/logic/monster.js');

// ── maxParty ─────────────────────────────────────────────────────────────────
test('maxParty() === 5', () => {
  assert.strictEqual(maxParty(), 5);
});

// ── enemyToCharacter ─────────────────────────────────────────────────────────
test('enemyToCharacter: 通常敵 isMonster===true, level===1, hp===maxHp', () => {
  const enemy = { id:'slime', name:'スライム', type:'power', hp:40, atk:8, def:5, spd:6, exp:10, gold:5, appears:[] };
  const ch = enemyToCharacter(enemy);
  assert.strictEqual(ch.isMonster, true);
  assert.strictEqual(ch.level, 1);
  assert.strictEqual(ch.hp, ch.maxHp);
  assert.strictEqual(ch.dead, false);
});

test('enemyToCharacter: id は baseId+"_mon"', () => {
  const enemy = { id:'goblin', name:'ゴブリン', type:'speed', hp:30, atk:7, def:4, spd:10, exp:8, gold:3, appears:[] };
  const ch = enemyToCharacter(enemy);
  assert.strictEqual(ch.id, 'goblin_mon');
  assert.strictEqual(ch.baseId, 'goblin');
});

test('enemyToCharacter: skills は配列コピー', () => {
  const sk = ['kick', 'dash'];
  const enemy = { id:'fast', name:'はやい', type:'speed', hp:20, atk:5, def:3, spd:15, exp:5, gold:2, appears:[], skills: sk };
  const ch = enemyToCharacter(enemy);
  assert.ok(Array.isArray(ch.skills));
  assert.deepStrictEqual(ch.skills, sk);
  // 元配列と別インスタンスであること
  ch.skills.push('extra');
  assert.strictEqual(sk.length, 2);
});

test('enemyToCharacter: skills 無し→空配列', () => {
  const enemy = { id:'rock', name:'いわ', type:'power', hp:60, atk:12, def:10, spd:2, exp:15, gold:8, appears:[] };
  const ch = enemyToCharacter(enemy);
  assert.ok(Array.isArray(ch.skills));
  assert.strictEqual(ch.skills.length, 0);
});

test('enemyToCharacter: equip.weapon===null, equip.armor===null', () => {
  const enemy = { id:'bat', name:'バット', type:'technique', hp:25, atk:6, def:3, spd:12, exp:7, gold:2, appears:[] };
  const ch = enemyToCharacter(enemy);
  assert.strictEqual(ch.equip.weapon, null);
  assert.strictEqual(ch.equip.armor, null);
});

test('enemyToCharacter: growth.hp >= 1 (maxMp=0でもgrowth.mp>=1)', () => {
  const enemy = { id:'mp0', name:'mpゼロ', type:'power', hp:50, atk:10, def:8, spd:5, exp:12, gold:6, appears:[] };
  const ch = enemyToCharacter(enemy);
  assert.ok(ch.growth.hp >= 1);
  assert.ok(ch.growth.mp >= 1, `growth.mp=${ch.growth.mp} should be >= 1`);
  assert.ok(ch.growth.atk >= 1);
  assert.ok(ch.growth.def >= 1);
  assert.ok(ch.growth.spd >= 1);
});

test('enemyToCharacter: 戦闘インスタンス（baseId/maxHp/削れたhp）でも maxHp 基準で満タン', () => {
  const battleInst = { baseId:'orc', id:'orc', name:'オーク', type:'power', hp:10, maxHp:80, atk:15, def:12, spd:5, exp:20, gold:10, appears:[] };
  const ch = enemyToCharacter(battleInst);
  assert.strictEqual(ch.maxHp, 80);
  assert.strictEqual(ch.hp, 80); // 満タン
  assert.strictEqual(ch.baseId, 'orc');
  assert.strictEqual(ch.id, 'orc_mon');
});

test('enemyToCharacter: growth の計算式確認', () => {
  const enemy = { id:'calc', name:'テスト', type:'technique', hp:100, atk:25, def:20, spd:10, exp:30, gold:15, appears:[] };
  const ch = enemyToCharacter(enemy);
  assert.strictEqual(ch.growth.hp, Math.max(1, Math.round(100 * 0.12)));
  assert.strictEqual(ch.growth.mp, 1); // maxMp=0 なので1
  assert.strictEqual(ch.growth.atk, Math.max(1, Math.round(25 * 0.12)));
  assert.strictEqual(ch.growth.def, Math.max(1, Math.round(20 * 0.12)));
  assert.strictEqual(ch.growth.spd, Math.max(1, Math.round(10 * 0.1)));
});

// ── canScout ─────────────────────────────────────────────────────────────────
test('canScout: ボスは false', () => {
  const boss = { id:'boss1', name:'ラスボス', type:'power', hp:500, atk:50, def:40, spd:20, exp:999, gold:999, isBoss:true, appears:[] };
  assert.strictEqual(canScout(boss), false);
});

test('canScout: 通常敵は true', () => {
  const normal = { id:'normal', name:'ふつう', type:'speed', hp:30, atk:7, def:4, spd:10, exp:8, gold:3, appears:[] };
  assert.strictEqual(canScout(normal), true);
});

test('canScout: レア敵（isBoss無し）は true', () => {
  const rare = { id:'rare1', name:'レア', type:'technique', hp:60, atk:15, def:10, spd:12, exp:50, gold:50, isRare:true, appears:[] };
  assert.strictEqual(canScout(rare), true);
});

// ── scoutChance ───────────────────────────────────────────────────────────────
test('scoutChance: ボスは 0', () => {
  const boss = { id:'boss', name:'ボス', type:'power', hp:500, atk:50, def:40, spd:20, isBoss:true };
  assert.strictEqual(scoutChance(boss), 0);
});

test('scoutChance: 通常満タン(hp=maxHp)は 0.5*0.15 付近', () => {
  const enemy = { id:'e1', name:'テ', type:'power', hp:100, maxHp:100, atk:10, def:8, spd:5 };
  const ch = scoutChance(enemy);
  // base=0.5, hpRatio=1 → chance=0.5*(1-0.85*1)=0.5*0.15=0.075
  assert.ok(Math.abs(ch - 0.075) < 0.0001, `expected ~0.075, got ${ch}`);
});

test('scoutChance: 瀕死(hp=1,maxHp=100)は満タンより大きい', () => {
  const full = { id:'e2', name:'テ', type:'power', hp:100, maxHp:100, atk:10, def:8, spd:5 };
  const low  = { id:'e3', name:'テ', type:'power', hp:1,   maxHp:100, atk:10, def:8, spd:5 };
  assert.ok(scoutChance(low) > scoutChance(full));
});

test('scoutChance: レア満タンは通常満タンより低い', () => {
  const normal = { id:'n1', name:'通常', type:'speed', hp:50, maxHp:50, atk:8, def:5, spd:10 };
  const rare   = { id:'r1', name:'レア', type:'speed', hp:50, maxHp:50, atk:8, def:5, spd:10, isRare:true };
  assert.ok(scoutChance(rare) < scoutChance(normal));
});

test('scoutChance: 戻り値は 0〜0.95 の範囲', () => {
  const cases = [
    { id:'a', name:'A', type:'power', hp:1,   maxHp:100, atk:10, def:8, spd:5 },
    { id:'b', name:'B', type:'power', hp:100, maxHp:100, atk:10, def:8, spd:5 },
    { id:'c', name:'C', type:'power', hp:50,  maxHp:100, atk:10, def:8, spd:5, isRare:true },
    { id:'d', name:'D', type:'power', hp:500, atk:50, def:40, spd:20, isBoss:true },
  ];
  for (const e of cases) {
    const ch = scoutChance(e);
    assert.ok(ch >= 0 && ch <= 0.95, `out of range: ${ch} for ${e.id}`);
  }
});

test('scoutChance: 単調減少（hp大きいほど小さい）', () => {
  const mk = hp => ({ id:'x', name:'X', type:'power', hp, maxHp:100, atk:10, def:8, spd:5 });
  const ch25 = scoutChance(mk(25));
  const ch75 = scoutChance(mk(75));
  assert.ok(ch25 > ch75, `hp=25 should give bigger chance than hp=75`);
});

// ── addToRoster ───────────────────────────────────────────────────────────────
test('addToRoster: party 4人 → "party" に入る', () => {
  const char = { id:'mon_mon', name:'モン', type:'power', level:1, hp:30, maxHp:30, atk:8, def:5, spd:6, isMonster:true };
  const state = { party: [{},{},{},{}], inventory:{}, gold:0, flags:{} };
  const result = addToRoster(state, char);
  assert.strictEqual(result, 'party');
  assert.strictEqual(state.party.length, 5);
});

test('addToRoster: party 5人（満杯）→ "roster" に入る', () => {
  const char = { id:'mon2_mon', name:'モン2', type:'speed', level:1, hp:20, maxHp:20, atk:5, def:3, spd:12, isMonster:true };
  const state = { party: [{},{},{},{},{}], inventory:{}, gold:0, flags:{} };
  const result = addToRoster(state, char);
  assert.strictEqual(result, 'roster');
  assert.ok(Array.isArray(state.roster));
  assert.strictEqual(state.roster.length, 1);
});

test('addToRoster: party未定義なら初期化', () => {
  const char = { id:'m_mon', name:'M', type:'technique', level:1, hp:25, maxHp:25, atk:6, def:4, spd:8, isMonster:true };
  const state = {};
  const result = addToRoster(state, char);
  assert.strictEqual(result, 'party');
  assert.ok(Array.isArray(state.party));
});

// ── swapInMonster ─────────────────────────────────────────────────────────────
test('swapInMonster: party満杯時は末尾と入替え（slot0不動）', () => {
  const leader  = { id:'yuito',  name:'ユイト' };
  const member1 = { id:'m1',     name:'m1' };
  const member2 = { id:'m2',     name:'m2' };
  const member3 = { id:'m3',     name:'m3' };
  const last    = { id:'last',   name:'last' };
  const rosterMon = { id:'mon_mon', name:'モンスター' };
  const state = {
    party: [leader, member1, member2, member3, last],
    roster: [rosterMon],
  };
  const result = swapInMonster(state, 0);
  assert.strictEqual(result, true);
  // slot0は必ずleaderのまま
  assert.strictEqual(state.party[0].id, 'yuito');
  // 末尾はrosterMonになる
  assert.strictEqual(state.party[state.party.length - 1].id, 'mon_mon');
  // last は roster に戻る
  assert.ok(state.roster.some(m => m.id === 'last'));
  // rosterMonはrosterから消える
  assert.ok(!state.roster.some(m => m.id === 'mon_mon'));
});

test('swapInMonster: party空きあり→単純にpartyへ移動', () => {
  const leader = { id:'yuito', name:'ユイト' };
  const rosterMon = { id:'mon_mon', name:'モンスター' };
  const state = {
    party: [leader, {id:'m1'}, {id:'m2'}],
    roster: [rosterMon],
  };
  const result = swapInMonster(state, 0);
  assert.strictEqual(result, true);
  assert.ok(state.party.some(m => m.id === 'mon_mon'));
  assert.ok(!state.roster.some(m => m.id === 'mon_mon'));
});

test('swapInMonster: rosterが無ければfalseを返す', () => {
  const state = { party: [{id:'yuito'}, {id:'m1'}] };
  const result = swapInMonster(state, 0);
  assert.strictEqual(result, false);
});

test('swapInMonster: 範囲外インデックスはfalseを返す', () => {
  const state = { party: [{id:'yuito'}], roster: [{id:'mon'}] };
  const result = swapInMonster(state, 5);
  assert.strictEqual(result, false);
});

test('swapInMonster: 負インデックスはfalseを返す', () => {
  const state = { party: [{id:'yuito'}], roster: [{id:'mon'}] };
  const result = swapInMonster(state, -1);
  assert.strictEqual(result, false);
});

// ── sendToRoster ─────────────────────────────────────────────────────────────
test('sendToRoster: index0（リーダー）は false', () => {
  const state = { party: [{id:'yuito'}, {id:'m1'}, {id:'m2'}] };
  const result = sendToRoster(state, 0);
  assert.strictEqual(result, false);
  assert.strictEqual(state.party.length, 3); // 変化なし
});

test('sendToRoster: 正常移動は true・partyから消えてrosterに入る', () => {
  const target = { id:'m2', name:'m2' };
  const state = { party: [{id:'yuito'}, {id:'m1'}, target, {id:'m3'}] };
  const result = sendToRoster(state, 2);
  assert.strictEqual(result, true);
  assert.ok(!state.party.some(m => m.id === 'm2'));
  assert.ok(Array.isArray(state.roster));
  assert.ok(state.roster.some(m => m.id === 'm2'));
});

test('sendToRoster: 範囲外インデックスは false', () => {
  const state = { party: [{id:'yuito'}, {id:'m1'}] };
  assert.strictEqual(sendToRoster(state, 5), false);
  assert.strictEqual(sendToRoster(state, -1), false);
});

test('sendToRoster: roster未定義でも自動作成して格納', () => {
  const state = { party: [{id:'yuito'}, {id:'m1'}] };
  const result = sendToRoster(state, 1);
  assert.strictEqual(result, true);
  assert.ok(Array.isArray(state.roster));
  assert.strictEqual(state.roster.length, 1);
});
