// === input.js ===
// 仮想十字キー＋決定/キャンセル ＆ キーボード を統一入力に変換する
// window/document はすべて関数内でのみアクセスする（Node require 対応）

var VW = 288;
var VH = 512;

// --- 仮想パッドのボタン矩形（位置・サイズの単一の真実：当たり判定と描画で共有） ---
// 十字キーは画面左下、決定/キャンセルは右下。各ボタンは指で押しやすい大きさ。
var DPAD_CX = 80;   // 十字キー中心X（左ボタンが画面左端に収まるよう DPAD_BTN*1.5=75 以上）
var DPAD_CY = 432;  // 十字キー中心Y
var DPAD_BTN = 50;  // 各方向ボタンの一辺（≒直径）
var ACT_R = 27;     // 決定/キャンセルボタンの半径
var BTN_DEFS = {
  up:    { type: 'rect', x: DPAD_CX - DPAD_BTN / 2,         y: DPAD_CY - DPAD_BTN * 1.5, w: DPAD_BTN, h: DPAD_BTN },
  down:  { type: 'rect', x: DPAD_CX - DPAD_BTN / 2,         y: DPAD_CY + DPAD_BTN / 2,   w: DPAD_BTN, h: DPAD_BTN },
  left:  { type: 'rect', x: DPAD_CX - DPAD_BTN * 1.5,       y: DPAD_CY - DPAD_BTN / 2,   w: DPAD_BTN, h: DPAD_BTN },
  right: { type: 'rect', x: DPAD_CX + DPAD_BTN / 2,         y: DPAD_CY - DPAD_BTN / 2,   w: DPAD_BTN, h: DPAD_BTN },
  confirm: { type: 'circle', cx: VW - 48, cy: 440, r: ACT_R, label: 'けってい' },
  cancel:  { type: 'circle', cx: VW - 104, cy: 410, r: ACT_R, label: 'もどる' },
};
var DIR_KEYS = ['up', 'down', 'left', 'right'];

// --- 入力状態 ---
function _blankState() {
  return { up: false, down: false, left: false, right: false, confirm: false, cancel: false };
}

var _canvasEl = null;
var _held = _blankState();      // 現在押されている状態（タッチ or キーボードの OR）
var _touchHeld = _blankState(); // タッチ由来の押下
var _keyHeld = _blankState();   // キーボード由来の押下
var _prevHeld = _blankState();  // 前フレームの held（エッジ算出用）
var _inited = false;

function _mergeHeld() {
  _held.up = _touchHeld.up || _keyHeld.up;
  _held.down = _touchHeld.down || _keyHeld.down;
  _held.left = _touchHeld.left || _keyHeld.left;
  _held.right = _touchHeld.right || _keyHeld.right;
  _held.confirm = _touchHeld.confirm || _keyHeld.confirm;
  _held.cancel = _touchHeld.cancel || _keyHeld.cancel;
}

// クライアント座標 → 仮想座標（0..VW × 0..VH）
function _toVirtual(clientX, clientY) {
  if (!_canvasEl || !_canvasEl.getBoundingClientRect) return { x: -1, y: -1 };
  var rect = _canvasEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: -1, y: -1 };
  return {
    x: (clientX - rect.left) * (VW / rect.width),
    y: (clientY - rect.top) * (VH / rect.height),
  };
}

// 仮想座標がどのボタンに当たるか（複数当たれば最初の一つ）
function _hitButton(vx, vy) {
  for (var key in BTN_DEFS) {
    if (!Object.prototype.hasOwnProperty.call(BTN_DEFS, key)) continue;
    var b = BTN_DEFS[key];
    if (b.type === 'rect') {
      if (vx >= b.x && vx <= b.x + b.w && vy >= b.y && vy <= b.y + b.h) return key;
    } else {
      var dx = vx - b.cx;
      var dy = vy - b.cy;
      if (dx * dx + dy * dy <= b.r * b.r) return key;
    }
  }
  return null;
}

// 全タッチ点を見て _touchHeld を作り直す（複数指の簡易対応）
function _updateTouches(touchList) {
  var next = _blankState();
  for (var i = 0; i < touchList.length; i++) {
    var t = touchList[i];
    var v = _toVirtual(t.clientX, t.clientY);
    var key = _hitButton(v.x, v.y);
    if (key) next[key] = true;
  }
  _touchHeld = next;
  _mergeHeld();
}

function _onTouch(e) {
  if (e.preventDefault) e.preventDefault();
  _updateTouches(e.touches || []);
}

function _keyToInput(key) {
  switch (key) {
    case 'ArrowUp': case 'Up': return 'up';
    case 'ArrowDown': case 'Down': return 'down';
    case 'ArrowLeft': case 'Left': return 'left';
    case 'ArrowRight': case 'Right': return 'right';
    case 'Enter': case ' ': case 'Spacebar': return 'confirm';
    case 'Escape': case 'Esc': case 'Backspace': return 'cancel';
    default: return null;
  }
}

function _onKeyDown(e) {
  var k = _keyToInput(e.key);
  if (!k) return;
  if (e.preventDefault) e.preventDefault();
  _keyHeld[k] = true;
  _mergeHeld();
}

function _onKeyUp(e) {
  var k = _keyToInput(e.key);
  if (!k) return;
  _keyHeld[k] = false;
  _mergeHeld();
}

function initInput(canvasEl) {
  _canvasEl = canvasEl;
  if (_inited) return;
  if (typeof window === 'undefined') return;
  var opts = { passive: false };
  if (canvasEl && canvasEl.addEventListener) {
    canvasEl.addEventListener('touchstart', _onTouch, opts);
    canvasEl.addEventListener('touchmove', _onTouch, opts);
    canvasEl.addEventListener('touchend', _onTouch, opts);
    canvasEl.addEventListener('touchcancel', _onTouch, opts);
  }
  window.addEventListener('keydown', _onKeyDown);
  window.addEventListener('keyup', _onKeyUp);
  _inited = true;
}

// メインループから毎フレーム呼ぶ。{held, pressed} を返す。
// pressed = 今フレームで新たに押された（前フレームでは押されていなかった）エッジ。
function pollInput() {
  var pressed = {
    up: _held.up && !_prevHeld.up,
    down: _held.down && !_prevHeld.down,
    left: _held.left && !_prevHeld.left,
    right: _held.right && !_prevHeld.right,
    confirm: _held.confirm && !_prevHeld.confirm,
    cancel: _held.cancel && !_prevHeld.cancel,
  };
  var held = {
    up: _held.up, down: _held.down, left: _held.left,
    right: _held.right, confirm: _held.confirm, cancel: _held.cancel,
  };
  // 次フレームのエッジ算出のため前フレーム状態を更新
  _prevHeld = {
    up: _held.up, down: _held.down, left: _held.left,
    right: _held.right, confirm: _held.confirm, cancel: _held.cancel,
  };
  return { held: held, pressed: pressed };
}

// --- 描画 ---
function _drawDirButton(ctx, key, label) {
  var b = BTN_DEFS[key];
  var active = _held[key];
  var fill = active ? 'rgba(94,200,255,0.55)' : 'rgba(40,46,72,0.85)';
  var border = active ? '#bff0ff' : '#5ec8ff';
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 10);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  // 矢印グリフ
  ctx.fillStyle = active ? '#0b0b12' : '#dff4ff';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  ctx.restore();
}

function _drawActButton(ctx, key) {
  var b = BTN_DEFS[key];
  var active = _held[key];
  var base = key === 'confirm' ? '#4caf50' : '#e0556b';
  var hi = key === 'confirm' ? '#a5ffb0' : '#ffb3c0';
  ctx.save();
  ctx.beginPath();
  ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);
  ctx.fillStyle = active ? hi : base;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.stroke();
  ctx.fillStyle = active ? '#0b0b12' : '#ffffff';
  ctx.font = '11px "Hiragino Maru Gothic ProN","Hiragino Kaku Gothic ProN",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.label, b.cx, b.cy + 1);
  ctx.restore();
}

// 仮想座標で画面下部に十字キー＋決定/キャンセルを描画。押下中はハイライト。
function drawPad(ctx) {
  if (!ctx) return;
  _drawDirButton(ctx, 'up', '▲');
  _drawDirButton(ctx, 'down', '▼');
  _drawDirButton(ctx, 'left', '◀');
  _drawDirButton(ctx, 'right', '▶');
  _drawActButton(ctx, 'confirm');
  _drawActButton(ctx, 'cancel');
}

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  initInput: initInput,
  pollInput: pollInput,
  drawPad: drawPad,
});
