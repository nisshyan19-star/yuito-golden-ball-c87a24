// === render.js ===
// 描画ヘルパ
// window/document はすべて関数内でのみアクセスする（Node require 対応）

/**
 * drawSprite: スプライトを描画する
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} sprite  { map: string[], palette: Object }
 * @param {number} x       左上X（仮想座標）
 * @param {number} y       左上Y（仮想座標）
 * @param {number} [scale] 1ピクセル=何仮想px か（デフォルト1）
 */
function drawSprite(ctx, sprite, x, y, scale) {
  if (!sprite || !sprite.map) return;
  scale = scale || 1;
  var map = sprite.map;
  var palette = sprite.palette;
  for (var row = 0; row < map.length; row++) {
    var line = map[row];
    for (var col = 0; col < line.length; col++) {
      var ch = line[col];
      if (ch === '.' || ch === ' ') continue;
      var color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
    }
  }
}

/**
 * drawTileMap: タイルマップを描画する
 * @param {CanvasRenderingContext2D} ctx
 * @param {string[][]} grid       2次元配列（各文字が tileSprites のキー）
 * @param {Object} tileSprites    { key: sprite, ... }
 * @param {number} tileSize       タイルの仮想px（スプライトは16px前提）
 * @param {number} offsetX
 * @param {number} offsetY
 */
function drawTileMap(ctx, grid, tileSprites, tileSize, offsetX, offsetY) {
  var scale = tileSize / 16;
  for (var r = 0; r < grid.length; r++) {
    for (var c = 0; c < grid[r].length; c++) {
      var key = grid[r][c];
      var sp = tileSprites[key];
      if (!sp) continue;
      drawSprite(ctx, sp, offsetX + c * tileSize, offsetY + r * tileSize, scale);
    }
  }
}

/**
 * drawText: テキストを描画する（日本語くっきりシステムフォント使用）
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} str
 * @param {number} x
 * @param {number} y
 * @param {Object} [opts]  { size, color, align, shadow:boolean, weight:string }
 */
function drawText(ctx, str, x, y, opts) {
  opts = opts || {};
  var size   = opts.size  || 12;
  var color  = opts.color || '#ffffff';
  var align  = opts.align || 'left';
  var weight = opts.weight ? (opts.weight + ' ') : '';
  ctx.font          = weight + size + 'px "Hiragino Maru Gothic ProN","Hiragino Kaku Gothic ProN",sans-serif';
  ctx.textBaseline  = 'top';
  ctx.textAlign     = align;
  // 影（任意）: 1px 右下にずらして先に描く
  if (opts.shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(str, x + 1, y + 1);
  }
  ctx.fillStyle     = color;
  ctx.fillText(str, x, y);
}

/**
 * drawShadow: キャラ足元の楕円影（接地感）
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx  中心X
 * @param {number} cy  中心Y
 * @param {number} rx  横半径
 * @param {number} ry  縦半径
 */
function drawShadow(ctx, cx, cy, rx, ry) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  if (ctx.ellipse) {
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  } else {
    // ellipse 非対応環境: scale で円を楕円化
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

/**
 * _rectPath: 角丸（roundRect 非対応環境は通常矩形）でパスを切る内部ヘルパ
 */
function _rectPath(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.rect(x, y, w, h);
  }
}

/**
 * drawWindow: 今風のパネル枠を描画する
 *  - ドロップシャドウ / 縦グラデ本体 / アクセント枠線 / 上辺ハイライト
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {Object} [opts]  { radius:10, border:'#5ec8ff', fill?:string }
 */
function drawWindow(ctx, x, y, w, h, opts) {
  opts = opts || {};
  var radius = (opts.radius !== undefined) ? opts.radius : 10;
  var border = opts.border || '#5ec8ff';

  ctx.save();

  // 1. ドロップシャドウ（本体より +3px 右下）
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  _rectPath(ctx, x + 3, y + 3, w, h, radius);
  ctx.fill();

  // 2. 本体塗り（opts.fill があればベタ、無ければ縦グラデ）
  if (opts.fill) {
    ctx.fillStyle = opts.fill;
  } else {
    var grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, 'rgba(30,34,58,0.95)');
    grad.addColorStop(1, 'rgba(16,18,34,0.97)');
    ctx.fillStyle = grad;
  }
  _rectPath(ctx, x, y, w, h, radius);
  ctx.fill();

  // 3. 枠線（2px アクセント色）
  ctx.strokeStyle = border;
  ctx.lineWidth   = 2;
  _rectPath(ctx, x, y, w, h, radius);
  ctx.stroke();

  // 4. 上辺内側の 1px ハイライト
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x + radius, y + 1.5);
  ctx.lineTo(x + w - radius, y + 1.5);
  ctx.stroke();

  ctx.restore();
}

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  drawSprite:  drawSprite,
  drawTileMap: drawTileMap,
  drawText:    drawText,
  drawWindow:  drawWindow,
  drawShadow:  drawShadow,
});
