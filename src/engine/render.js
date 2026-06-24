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
 * @param {Object} [opts]  { size: number, color: string, align: string }
 */
function drawText(ctx, str, x, y, opts) {
  opts = opts || {};
  var size  = opts.size  || 12;
  var color = opts.color || '#ffffff';
  var align = opts.align || 'left';
  ctx.font          = size + 'px "Hiragino Maru Gothic ProN","Hiragino Kaku Gothic ProN",sans-serif';
  ctx.textBaseline  = 'top';
  ctx.textAlign     = align;
  ctx.fillStyle     = color;
  ctx.fillText(str, x, y);
}

/**
 * drawWindow: ドラクエ風メッセージ枠を描画する
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {Object} [opts]  { fill: string, border: string, radius: number }
 */
function drawWindow(ctx, x, y, w, h, opts) {
  opts = opts || {};
  var fill   = opts.fill   || '#0a1230';
  var border = opts.border || '#ffffff';
  var radius = (opts.radius !== undefined) ? opts.radius : 6;

  ctx.save();

  // 塗り
  ctx.fillStyle = fill;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }

  // 枠線
  ctx.strokeStyle = border;
  ctx.lineWidth   = 2;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.stroke();
  } else {
    ctx.strokeRect(x, y, w, h);
  }

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
});
