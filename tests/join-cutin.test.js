'use strict';
const test = require('node:test');
const assert = require('node:assert');

// window を用意して field-scene.js を UMD ロード（他テストと同じ流儀）
global.window = global.window || {};
require('../src/data/characters.js');
require('../src/engine/audio.js');
const S = require('../src/scenes/field-scene.js');
Object.assign(global.window.SRPG || (global.window.SRPG = {}), S);
global.window.SRPG.VW = 288;
global.window.SRPG.VH = 512;
global.window.SRPG.playSe = function () {};

test('createJoinCutinScene: confirm で onClose が呼ばれ isDone になる', () => {
  let closed = false;
  const sc = S.createJoinCutinScene({}, 'ikuma', function () { closed = true; });
  assert.strictEqual(typeof sc.update, 'function');
  assert.strictEqual(sc.isDone(), false);
  // 0.5秒 経過前は閉じない
  sc.update(0.2, { pressed: { confirm: true } });
  assert.strictEqual(sc.isDone(), false, '演出中は閉じない');
  // 0.5秒 以降は confirm で閉じる
  sc.update(0.5, { pressed: {} });
  sc.update(0.1, { pressed: { confirm: true } });
  assert.strictEqual(closed, true, 'onClose が呼ばれる');
  assert.strictEqual(sc.isDone(), true);
});
