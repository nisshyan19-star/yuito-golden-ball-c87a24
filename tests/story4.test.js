// === story4.test.js（弾4：物語・演出＝ボスセリフ/加入ドラマ/カットシーン/ED強化） ===
const test   = require('node:test');
const assert = require('node:assert');
const { ENEMIES } = require('../src/data/enemies.js');
const { MAPS }    = require('../src/data/maps.js');
const { getEnding } = require('../src/data/story.js');
const { pendingCutscene } = require('../src/scenes/field-scene.js');

// ── ボスセリフ：3ボスに intro/defeat が付いている ────────────────────────
test('ボス3体に quotes(intro/defeat) が定義されている', () => {
  ['guardian', 'dark_kaiser', 'phantom_striker'].forEach((id) => {
    const e = ENEMIES[id];
    assert.ok(e, id + ' が無い');
    assert.ok(e.quotes, id + ' に quotes が無い');
    assert.ok(e.quotes.intro, id + ' に intro セリフが無い');
    assert.ok(e.quotes.defeat, id + ' に defeat セリフが無い');
  });
});

test('2段階ボスには phase セリフがある', () => {
  ['dark_kaiser', 'phantom_striker'].forEach((id) => {
    assert.ok(ENEMIES[id].quotes.phase, id + ' に phase セリフが無い');
  });
});

// ── 加入ドラマ：ポジションのロール（characters.js 正典）と一致 ──────────────
function joinNpc(mapId, joinId) {
  const npc = (MAPS[mapId].npcs || []).find((n) => n.joinId === joinId);
  assert.ok(npc, mapId + ' に joinId=' + joinId + ' のNPCが無い');
  return npc.pages.join('\n');
}

test('イクマは FW（ストライカー）として描かれる（GK表記の修正）', () => {
  const t = joinNpc('field1', 'ikuma');
  assert.ok(t.indexOf('FW') >= 0 || t.indexOf('フォワード') >= 0, 'イクマがFWでない');
  assert.ok(t.indexOf('ストライカー') >= 0, 'イクマがストライカーでない');
  assert.strictEqual(t.indexOf('GK'), -1, 'イクマに誤りのGK表記が残っている');
});

test('アオシは 司令塔（MF・テクニック）として描かれる', () => {
  const t = joinNpc('field2', 'aoshi');
  assert.ok(t.indexOf('司令塔') >= 0, 'アオシが司令塔でない');
  assert.ok(t.indexOf('MF') >= 0 || t.indexOf('ミッドフィルダー') >= 0, 'アオシがMFでない');
});

test('トモキは DF（ディフェンダー）として描かれる', () => {
  const t = joinNpc('field3', 'tomoki');
  assert.ok(t.indexOf('DF') >= 0 || t.indexOf('ディフェンダー') >= 0, 'トモキがDFでない');
});

test('イツキは GK（守護神）として描かれる（MF表記の修正）', () => {
  const t = joinNpc('field4', 'itsuki');
  assert.ok(t.indexOf('GK') >= 0, 'イツキがGKでない');
  assert.ok(t.indexOf('守護神') >= 0, 'イツキが守護神でない');
  assert.strictEqual(t.indexOf('MF'), -1, 'イツキに誤りのMF表記が残っている');
});

test('加入ドラマは複数ページのドラマになっている（各4ページ以上）', () => {
  [['field1', 'ikuma'], ['field2', 'aoshi'], ['field3', 'tomoki'], ['field4', 'itsuki']]
    .forEach(([mapId, joinId]) => {
      const npc = MAPS[mapId].npcs.find((n) => n.joinId === joinId);
      assert.ok(npc.pages.length >= 4, mapId + '/' + joinId + ' のドラマが短い');
    });
});

// ── カットシーン：field1/field6/town3 に cutscene が定義されている ──────────
test('カットシーンが field1/field6/town3 に定義されている', () => {
  const specs = [
    ['field1', 'cs_intro'],
    ['field6', 'cs_field6'],
    ['town3',  'cs_town3'],
  ];
  specs.forEach(([mapId, flag]) => {
    const cs = MAPS[mapId].cutscene;
    assert.ok(cs, mapId + ' に cutscene が無い');
    assert.strictEqual(cs.flag, flag, mapId + ' の cutscene.flag が違う');
    assert.ok(Array.isArray(cs.pages) && cs.pages.length >= 3, mapId + ' の cutscene pages が不足');
  });
});

// ── pendingCutscene：フラグ未/既で正しく出し分ける ──────────────────────────
test('pendingCutscene はフラグ未設定なら cutscene を返す', () => {
  const cs = pendingCutscene(MAPS.field1, {});
  assert.ok(cs, 'フラグ無しなのに null');
  assert.strictEqual(cs.flag, 'cs_intro');
});

test('pendingCutscene はフラグ済みなら null を返す（二度流れない）', () => {
  const cs = pendingCutscene(MAPS.field1, { cs_intro: true });
  assert.strictEqual(cs, null, 'フラグ済みなのに再生してしまう');
});

test('pendingCutscene は cutscene の無いマップで null を返す', () => {
  assert.strictEqual(pendingCutscene(MAPS.field2, {}), null, 'cutscene 無しマップで null でない');
});

// ── ED強化：スタッフロール＋仲間ごとの別れ ───────────────────────────────
test('getEnding にスタッフロールが含まれる', () => {
  const pages = getEnding({ party: [{ id: 'yuito', name: 'ユイト' }] });
  const text = pages.join('\n');
  assert.ok(text.indexOf('スタッフロール') >= 0, 'スタッフロールが無い');
  assert.ok(text.indexOf('おわり') >= 0, '「おわり」が無い');
});

test('getEnding は加入している仲間の別れセリフを差し込む', () => {
  const party = [
    { id: 'yuito',  name: 'ユイト' },
    { id: 'ikuma',  name: 'イクマ' },
    { id: 'itsuki', name: 'イツキ' },
  ];
  const text = getEnding({ party }).join('\n');
  assert.ok(text.indexOf('イクマ「') >= 0, 'イクマの別れが無い');
  assert.ok(text.indexOf('イツキ「') >= 0, 'イツキの別れが無い');
  // 加入していない子（アオシ）の別れは出ない
  assert.strictEqual(text.indexOf('アオシ「'), -1, '未加入アオシの別れが出ている');
});

test('getEnding は旧版より長い（演出強化）', () => {
  const pages = getEnding({ party: [
    { id: 'yuito', name: 'ユイト' },
    { id: 'ikuma', name: 'イクマ' },
    { id: 'aoshi', name: 'アオシ' },
    { id: 'tomoki', name: 'トモキ' },
    { id: 'itsuki', name: 'イツキ' },
  ] });
  assert.ok(pages.length >= 12, 'エンディングが強化されていない（ページ数 ' + pages.length + '）');
});
