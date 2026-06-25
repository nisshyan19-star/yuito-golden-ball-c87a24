// === storage.js ===
// localStorage + save.js のラッパ。
// save.js の関数は Node なら require、ブラウザなら window.SRPG から取得（二刀流）。
// localStorage が無い環境（Node）でも落ちないようガードする。

var _save = (typeof require !== 'undefined')
  ? require('../logic/save.js')
  : (typeof window !== 'undefined' && window.SRPG ? window.SRPG : null);

var SAVE_KEY = 'srpg_save';

// 利用可能なら localStorage を返す。無い／例外なら null。
function _ls() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch (e) { /* セキュリティ設定等でアクセス不可 */ }
  return null;
}

// state を保存。成功 true / 失敗 false。
function saveGame(state) {
  var ls = _ls();
  if (!ls || !_save || !_save.serialize) return false;
  try {
    ls.setItem(SAVE_KEY, _save.serialize(state));
    return true;
  } catch (e) {
    return false;
  }
}

// 保存済み state を返す。無ければ null。
function loadGame() {
  var ls = _ls();
  if (!ls || !_save || !_save.deserialize) return null;
  try {
    var str = ls.getItem(SAVE_KEY);
    if (str == null) return null;
    return _save.deserialize(str);
  } catch (e) {
    return null;
  }
}

// セーブが存在するか。
function hasSave() {
  var ls = _ls();
  if (!ls) return false;
  try {
    return ls.getItem(SAVE_KEY) != null;
  } catch (e) {
    return false;
  }
}

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  saveGame: saveGame,
  loadGame: loadGame,
  hasSave: hasSave,
  SAVE_KEY: SAVE_KEY,
});
