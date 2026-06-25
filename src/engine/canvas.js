// === canvas.js ===
// 仮想解像度キャンバス & スケーリング
// window/document はすべて関数内でのみアクセスする（Node require 対応）

var VW = 288;
var VH = 512;

var _ctx = null;
var _canvasEl = null;

function resize() {
  if (!_canvasEl) return;
  var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
  var iw = (typeof window !== 'undefined') ? window.innerWidth : VW;
  var ih = (typeof window !== 'undefined') ? window.innerHeight : VH;
  var cssScale = Math.min(iw / VW, ih / VH);

  _canvasEl.style.width  = (VW * cssScale) + 'px';
  _canvasEl.style.height = (VH * cssScale) + 'px';

  _canvasEl.width  = Math.round(VW * cssScale * dpr);
  _canvasEl.height = Math.round(VH * cssScale * dpr);

  _ctx = _canvasEl.getContext('2d');
  _ctx.setTransform(cssScale * dpr, 0, 0, cssScale * dpr, 0, 0);
  _ctx.imageSmoothingEnabled = false;
}

function initCanvas(canvasEl) {
  _canvasEl = canvasEl;
  resize();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', resize);
  }
}

function getCtx() {
  return _ctx;
}

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  VW: VW,
  VH: VH,
  initCanvas: initCanvas,
  getCtx: getCtx,
  resize: resize,
});
