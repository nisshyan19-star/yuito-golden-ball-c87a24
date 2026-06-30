// ============================================================
// field-art.js  ―  フィールド地形タイル（旧：AI生成テクスチャ。現在は空）
// ------------------------------------------------------------
// ★Phase7-①(2026-06-29)で全ベース地形タイルを field-scene.js の
//   _drawBaseTile() による「コード描画」に全面移行したため、ここの
//   AIテクスチャ(dataURL)は不要になり削除した（index.htmlを約720KB圧縮）。
//   draw() は base タイルを _drawBaseTile() で描き、FIELD_ART は
//   後方互換のフォールバック口として空オブジェクトのまま残す
//   （S.FIELD_ART[sprite] が undefined → ドット絵(SPRITES)へ自動フォールバック）。
// ★バンドル注意：全srcが1スコープを共有。top-level は `var FIELD_ART` ただ1つ。
// ============================================================

var FIELD_ART = {};

(function (root, api) {
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== "undefined" ? window : globalThis, { FIELD_ART: FIELD_ART });
