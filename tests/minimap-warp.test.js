const test = require('node:test');
const assert = require('node:assert');
global.window = global.window || {};
const S = require('../src/scenes/field-scene.js');

test('minimapWarpDots: map.warps の各座標を紫点として返す', () => {
  const map = { warps: [ { x:2, y:9, to:'cave1_secret' }, { x:5, y:5, tx:1, ty:1 } ] };
  const dots = S.minimapWarpDots(map, 100, 10, 4);
  assert.strictEqual(dots.length, 2);
  assert.strictEqual(dots[0].color, '#d6aaff');
  assert.strictEqual(dots[0].px, 100 + 2 * 4);
  assert.strictEqual(dots[0].py, 10 + 9 * 4);
});

test('minimapWarpDots: warps未定義でも空配列', () => {
  assert.deepStrictEqual(S.minimapWarpDots({}, 0, 0, 4), []);
});
