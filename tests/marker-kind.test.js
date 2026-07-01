const test   = require('node:test');
const assert = require('node:assert');
const { npcMarkerKind } = require('../src/scenes/field-scene.js');

// npcMarkerKind: マップ上のNPCの頭上に出すマークの種類を返す純粋関数。
// 判定は話しかけ処理 _talkTo と同じ優先順位（shop→forge→joinId→boss→bossRush→quest→会話）。
// 役割NPCが「済み状態」(加入済み/撃破済み/完了)なら、まだ会話できるので 'talk' に落ちる。

const S0 = { flags: {}, party: [] };

test('お店（道具/装備・inn以外）→ shop', () => {
  assert.strictEqual(npcMarkerKind({ sprite: 'shopkeep', shop: { name: 'どうぐや' } }, S0), 'shop');
});

test('宿屋（shop.type=inn）→ inn', () => {
  assert.strictEqual(npcMarkerKind({ sprite: 'shopkeep', shop: { type: 'inn', cost: 20 } }, S0), 'inn');
});

test('かじや（forge）→ forge', () => {
  assert.strictEqual(npcMarkerKind({ sprite: 'coach', forge: {} }, S0), 'forge');
});

test('未加入の仲間（joinId・未加入）→ ally', () => {
  assert.strictEqual(npcMarkerKind({ joinId: 'aoshi', pages: ['やあ'] }, S0), 'ally');
});

test('加入済みの仲間 → talk（もう仲間なので会話マーク）', () => {
  const S = { flags: {}, party: [{ id: 'aoshi' }] };
  assert.strictEqual(npcMarkerKind({ joinId: 'aoshi' }, S), 'talk');
});

test('未撃破ボス（boss・winFlag未達）→ boss', () => {
  assert.strictEqual(npcMarkerKind({ boss: { winFlag: 'w1', enemies: [] }, pages: ['いくぞ'] }, S0), 'boss');
});

test('撃破済みボス（flags[winFlag]=true）→ talk', () => {
  const S = { flags: { w1: true }, party: [] };
  assert.strictEqual(npcMarkerKind({ boss: { winFlag: 'w1' }, afterPages: ['まけた…'] }, S), 'talk');
});

test('未クリアのボスラッシュ（bossRush）→ boss', () => {
  assert.strictEqual(npcMarkerKind({ bossRush: { winFlag: 'br' }, pages: ['?'] }, S0), 'boss');
});

test('未完了クエスト（quest・doneFlag未達）→ quest', () => {
  assert.strictEqual(npcMarkerKind({ quest: { doneFlag: 'q1', askPages: ['たのむ'] } }, S0), 'quest');
});

test('完了クエスト（flags[doneFlag]=true）→ talk', () => {
  const S = { flags: { q1: true }, party: [] };
  assert.strictEqual(npcMarkerKind({ quest: { doneFlag: 'q1' } }, S), 'talk');
});

test('通常の会話NPC（pages）→ talk', () => {
  assert.strictEqual(npcMarkerKind({ sprite: 'ikuma', pages: ['こんにちは'] }, S0), 'talk');
});

test('会話も役割も無いNPC → none', () => {
  assert.strictEqual(npcMarkerKind({ sprite: 'ikuma' }, S0), 'none');
});

test('npc が null → none（クラッシュしない）', () => {
  assert.strictEqual(npcMarkerKind(null, S0), 'none');
});

test('state 未指定でも shop 判定できる', () => {
  assert.strictEqual(npcMarkerKind({ shop: {} }, undefined), 'shop');
});
