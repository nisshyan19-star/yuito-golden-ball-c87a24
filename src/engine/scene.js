// === scene.js ===
// シーンスタック。シーンは {update(dt,input), draw(ctx), onEnter?(), onExit?()} のダックタイプ。
// window/document はすべて関数内でのみアクセスする（Node require 対応）

var _stack = [];

function pushScene(scene) {
  if (!scene) return;
  _stack.push(scene);
  if (typeof scene.onEnter === 'function') scene.onEnter();
}

function popScene() {
  var scene = _stack.pop();
  if (scene && typeof scene.onExit === 'function') scene.onExit();
  return scene || null;
}

function replaceScene(scene) {
  popScene();
  pushScene(scene);
}

function currentScene() {
  return _stack.length ? _stack[_stack.length - 1] : null;
}

// 一番上のシーンだけ更新する。
function updateScenes(dt, input) {
  var top = currentScene();
  if (top && typeof top.update === 'function') top.update(dt, input);
}

// 一番上のシーンを描画する。transparent フラグを持つシーンは下も描く（軽い拡張）。
function drawScenes(ctx) {
  if (!_stack.length) return;
  // 不透明な最下層を探す（透明なシーンが重なっていれば下から描く）
  var start = _stack.length - 1;
  while (start > 0 && _stack[start].transparent) start--;
  for (var i = start; i < _stack.length; i++) {
    var s = _stack[i];
    if (s && typeof s.draw === 'function') s.draw(ctx);
  }
}

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  pushScene: pushScene,
  popScene: popScene,
  replaceScene: replaceScene,
  currentScene: currentScene,
  updateScenes: updateScenes,
  drawScenes: drawScenes,
});
