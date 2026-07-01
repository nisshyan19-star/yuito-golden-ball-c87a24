'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { nearestExitLabel } = require('../src/scenes/field-scene.js');

// モックのマップ辞書（実データに依存しない）
const MAPS = {
  town1: { name: 'ハーバータウン' },
  cave1: { name: 'ほのおの どうくつ' },
};

test('半径内の出口名を返す', () => {
  const map = { exits: [{ x: 5, y: 5, to: 'town1' }] };
  assert.strictEqual(nearestExitLabel(map, 5, 6, 2, MAPS), '→ ハーバータウンへ');
});

test('半径外なら null', () => {
  const map = { exits: [{ x: 5, y: 5, to: 'town1' }] };
  assert.strictEqual(nearestExitLabel(map, 0, 0, 2, MAPS), null);
});

test('複数出口では最寄りを返す', () => {
  const map = { exits: [
    { x: 0, y: 0, to: 'cave1' },
    { x: 5, y: 5, to: 'town1' },
  ] };
  assert.strictEqual(nearestExitLabel(map, 5, 5, 2, MAPS), '→ ハーバータウンへ');
});

test('マップ辞書に無い to は to をそのまま名前に使う', () => {
  const map = { exits: [{ x: 1, y: 1, to: 'field9' }] };
  assert.strictEqual(nearestExitLabel(map, 1, 1, 2, MAPS), '→ field9へ');
});

test('exits が無い/空なら null', () => {
  assert.strictEqual(nearestExitLabel({ exits: [] }, 1, 1, 2, MAPS), null);
  assert.strictEqual(nearestExitLabel({}, 1, 1, 2, MAPS), null);
  assert.strictEqual(nearestExitLabel(null, 1, 1, 2, MAPS), null);
});

test('座標欠損の出口はスキップ', () => {
  const map = { exits: [{ to: 'town1' }, { x: 3, y: 3, to: 'cave1' }] };
  assert.strictEqual(nearestExitLabel(map, 3, 3, 2, MAPS), '→ ほのおの どうくつへ');
});
