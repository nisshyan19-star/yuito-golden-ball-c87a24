const { test } = require('node:test');
const assert = require('node:assert');
const { MAPS } = require('../src/data/maps.js');

function findExitTo(mapId, toId) {
  return (MAPS[mapId].exits || []).find(e => e.to === toId);
}

// [ホストマップ, 逆流先, 期待 x, y, tx, ty]
const REVERSE_CH1 = [
  ['town1',  'field1', 7, 1, 7, 15], // R1
  ['field2', 'town1',  7, 1, 7, 15], // R2
  ['field3', 'field2', 7, 1, 7, 15], // R3
  ['town2',  'field3', 7, 1, 7, 15], // R4
  ['field4', 'town2',  7, 1, 7, 15], // R5
  ['field5', 'field4', 7, 1, 7, 15], // R6
  ['town3',  'field5', 6, 1, 7, 15], // R7（7,1 は ch2_gate 占有→6,1）
  ['field6', 'town3',  7, 1, 7, 15], // R8
];

for (const [host, to, x, y, tx, ty] of REVERSE_CH1) {
  test(`逆流: ${host} → ${to} 出口が存在し座標が正しい`, () => {
    const e = findExitTo(host, to);
    assert.ok(e, `${host}→${to} の逆流出口が無い`);
    assert.strictEqual(e.x, x);
    assert.strictEqual(e.y, y);
    assert.strictEqual(e.tx, tx);
    assert.strictEqual(e.ty, ty);
    assert.strictEqual(e.requireFlag, undefined, '逆流にゲートを付けない');
  });
}

// [ホスト, 逆流先, x, y, tx, ty, requireFlag]
const REVERSE_CH3 = [
  ['ch2_castle', 'wc_stadium',    8, 15, 7, 15, 'boss_neo_kaiser'], // R9
  ['wc_stadium', 'nebula_f1',     9, 10, 7, 15, 'boss_volg'],       // R10
  ['nebula_f3',  'star_shrine_1', 8,  4, 7, 15, 'boss_zeros'],      // R11
];

for (const [host, to, x, y, tx, ty, flag] of REVERSE_CH3) {
  test(`逆流(第3章): ${host} → ${to} 出口が ${flag} ゲートで存在`, () => {
    const e = findExitTo(host, to);
    assert.ok(e, `${host}→${to} の逆流出口が無い`);
    assert.strictEqual(e.x, x);
    assert.strictEqual(e.y, y);
    assert.strictEqual(e.tx, tx);
    assert.strictEqual(e.ty, ty);
    assert.strictEqual(e.requireFlag, flag);
    assert.ok(e.lockedMsg && e.lockedMsg.length > 0);
  });
}

test('第3章の前進ゲートは不変（nebula_f1→nebula_f2 は nebula_f1 フラグ）', () => {
  const fwd = (MAPS.nebula_f1.exits || []).find(e => e.to === 'nebula_f2');
  assert.ok(fwd);
  assert.strictEqual(fwd.requireFlag, 'nebula_f1');
});
