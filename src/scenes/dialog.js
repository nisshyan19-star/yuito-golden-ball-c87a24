// === dialog.js ===
// メッセージウィンドウ（タイプライター文字送り・ページ送り対応のモーダルシーン）。
// window/document は draw 内でのみアクセスし、Node require でも副作用ゼロ。

// ── 純粋ロジック（テスト対象） ──────────────────────────────────────

/**
 * wrapText: 文字列を最大文字数で折り返す。
 * '\n' で先に分割し、各行を maxCharsPerLine 文字で詰める。
 * @param {string} str
 * @param {number} maxCharsPerLine
 * @returns {string[]}
 */
function wrapText(str, maxCharsPerLine) {
  var lines = str.split('\n');
  var result = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.length === 0) {
      result.push('');
      continue;
    }
    var pos = 0;
    while (pos < line.length) {
      result.push(line.slice(pos, pos + maxCharsPerLine));
      pos += maxCharsPerLine;
    }
  }
  return result;
}

/**
 * DialogState: dialog の純粋ロジック状態。draw 不要な部分だけを分離。
 * update(dt, pressedConfirm) → { done: bool, changed: bool }
 */
function createDialogState(pages) {
  var _pages       = pages || [''];
  var _pageIndex   = 0;       // 現在のページ番号
  var _charIndex   = 0;       // 表示済み文字数（現在ページ内）
  var _elapsed     = 0;       // 文字送り用タイマー
  var _done        = false;
  var CHARS_PER_SEC = 45;     // 文字送り速度

  function _currentPage() { return _pages[_pageIndex] || ''; }
  function _isLastPage()  { return _pageIndex >= _pages.length - 1; }
  function _isFullyShown(){ return _charIndex >= _currentPage().length; }

  function update(dt, pressedConfirm) {
    if (_done) return { done: true, changed: false };

    // 文字送り（確定押されていない間）
    if (!pressedConfirm) {
      _elapsed += dt;
      var newChars = Math.floor(_elapsed * CHARS_PER_SEC);
      if (newChars > _charIndex) {
        _charIndex = Math.min(newChars, _currentPage().length);
      }
      return { done: false, changed: false };
    }

    // confirm が押された
    if (!_isFullyShown()) {
      // 送り途中 → 全部表示
      _charIndex = _currentPage().length;
      return { done: false, changed: false };
    }

    // 全部表示済み → 次ページへ or 完了
    if (!_isLastPage()) {
      _pageIndex++;
      _charIndex = 0;
      _elapsed   = 0;
      return { done: false, changed: true };
    }

    // 最終ページで confirm → 完了
    _done = true;
    return { done: true, changed: false };
  }

  function getVisibleText() {
    return _currentPage().slice(0, _charIndex);
  }

  function isDone() { return _done; }
  function isPageComplete() { return _isFullyShown(); }

  return {
    update: update,
    getVisibleText: getVisibleText,
    isDone: isDone,
    isPageComplete: isPageComplete,
  };
}

// ── シーンファクトリ ────────────────────────────────────────────────

/**
 * createDialog: メッセージウィンドウシーンを生成して返す。
 * @param {string[]} pages   1要素＝1ページの本文（'\n' 含んでよい）
 * @param {Object}  [opts]   { onComplete: function }
 * @returns シーンオブジェクト { transparent, update, draw, isDone }
 */
function createDialog(pages, opts) {
  opts = opts || {};
  var state   = createDialogState(pages);
  var _popped = false;

  // ウィンドウの仮想座標（仮想解像度 288×512）
  // 仮想パッド（input.js）は画面下部 y≈357〜507 を占有するため、
  // メッセージ窓はその上に収める。winY = VH - 287 = 225、窓底 345 でパッド上端 357 と衝突しない。
  var WIN_X = 12;
  var WIN_Y_OFFSET = 287; // VH - この値（パッドの上に窓を置く）
  var WIN_W = 264;        // VW - 24
  var WIN_H = 120;
  var PAD_X = 12;         // ウィンドウ内パディング
  var PAD_Y = 10;
  var FONT_SIZE = 14;
  var LINE_H   = 20;
  var MAX_CHARS_PER_LINE = 17; // 264px ÷ 約14px/字（日本語等幅換算）

  return {
    transparent: true,

    update: function (dt, input) {
      if (_popped) return;
      var result = state.update(dt, !!(input && input.pressed && input.pressed.confirm));
      if (result.done && !_popped) {
        _popped = true;
        // 先に pop、その後 onComplete（onComplete が push しても破綻しない）
        if (typeof window !== 'undefined' && window.SRPG && typeof window.SRPG.popScene === 'function') {
          window.SRPG.popScene();
        }
        if (typeof opts.onComplete === 'function') opts.onComplete();
      }
    },

    draw: function (ctx) {
      var S = (typeof window !== 'undefined') ? window.SRPG : null;
      if (!S) return;
      var VH = S.VH;
      var winY = VH - WIN_Y_OFFSET;

      // ウィンドウ枠
      S.drawWindow(ctx, WIN_X, winY, WIN_W, WIN_H, {
        radius: 8,
        border: '#5ec8ff',
      });

      // テキスト折り返し・描画
      var visible = state.getVisibleText();
      var wrapped = wrapText(visible, MAX_CHARS_PER_LINE);
      for (var i = 0; i < wrapped.length; i++) {
        S.drawText(ctx, wrapped[i], WIN_X + PAD_X, winY + PAD_Y + i * LINE_H, {
          size: FONT_SIZE,
          color: '#dff4ff',
        });
      }

      // ページ送り促進インジケーター（▼）― 現在ページを全文表示済みかつ未完了のとき右下に点滅
      if (state.isPageComplete() && !state.isDone()) {
        var blink = Math.floor(Date.now() / 400) % 2 === 0;
        if (blink) {
          S.drawText(ctx, '▼', WIN_X + WIN_W - PAD_X - 12, winY + WIN_H - 18, {
            size: 12,
            color: '#5ec8ff',
          });
        }
      }
    },

    isDone: function () { return state.isDone(); },

    // テスト用: 内部 state を公開（Node テストのみ利用）
    _state: state,
  };
}

// ── UMD エクスポート ──────────────────────────────────────────────────
(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  createDialog:      createDialog,
  wrapText:          wrapText,
  createDialogState: createDialogState,
});
