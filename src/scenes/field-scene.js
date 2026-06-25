// === field-scene.js ===
// フィールド探索シーン。タイルマップ上でユイトを十字キー移動し、
// NPC と話す / 宝箱を開ける / ランダムエンカウントする。
// 純粋ロジック（frontTile / isWalkable / clampCamera）はテスト対象として分離。
// window/document はシーン本体の update/draw 内でのみ参照（Node require で副作用ゼロ）。

// ── データ遅延解決（game-state.js の _characters() と同じパターン） ──────
//   Node: require でモジュールから取得。ブラウザ: window.SRPG から取得。
function _tileLegend() {
  if (typeof require !== 'undefined') return require('../data/maps.js').TILE_LEGEND;
  return (typeof window !== 'undefined' && window.SRPG && window.SRPG.TILE_LEGEND) || {};
}
function _maps() {
  if (typeof require !== 'undefined') return require('../data/maps.js').MAPS;
  return (typeof window !== 'undefined' && window.SRPG && window.SRPG.MAPS) || {};
}

// ── 純粋ロジック（テスト対象） ──────────────────────────────────────

/**
 * frontTile: 向き facing の正面（隣接）タイル座標を返す。
 * @param {number} x
 * @param {number} y
 * @param {string} facing 'up' | 'down' | 'left' | 'right'
 * @returns {{x:number, y:number}}
 */
function frontTile(x, y, facing) {
  switch (facing) {
    case 'up':    return { x: x,     y: y - 1 };
    case 'down':  return { x: x,     y: y + 1 };
    case 'left':  return { x: x - 1, y: y     };
    case 'right': return { x: x + 1, y: y     };
    default:      return { x: x,     y: y     };
  }
}

/**
 * isWalkable: 座標 (x,y) に踏み込めるか判定する。
 *   - グリッド範囲外 → false
 *   - タイルが walkable:false（壁/水）→ false
 *   - NPC が居る → false
 *   - 未開封の宝箱がある → false（開封済みは通れる）
 * @param {Object} map     MAPS のエントリ（grid / npcs / chests を持つ）
 * @param {number} x
 * @param {number} y
 * @param {Object} [opened] { chestId: true } の開封済み集合
 * @returns {boolean}
 */
function isWalkable(map, x, y, opened) {
  opened = opened || {};
  var grid = map.grid;
  // 範囲外
  if (y < 0 || y >= grid.length) return false;
  var row = grid[y];
  if (x < 0 || x >= row.length) return false;
  // タイル種別
  var legend = _tileLegend();
  var tile = legend[row[x]];
  if (!tile || !tile.walkable) return false;
  // NPC
  var npcs = map.npcs || [];
  for (var i = 0; i < npcs.length; i++) {
    if (npcs[i].x === x && npcs[i].y === y) return false;
  }
  // 未開封の宝箱
  var chests = map.chests || [];
  for (var j = 0; j < chests.length; j++) {
    var c = chests[j];
    if (c.x === x && c.y === y && !opened[c.id]) return false;
  }
  return true;
}

/**
 * clampCamera: カメラオフセットを画面内に収める。
 *   - 地図が画面以下のサイズ → 中央寄せ（(screen-mapPx)/2 を四捨五入）
 *   - それ以外 → desired を [screen-mapPx, 0] にクランプ
 * @param {number} desired 望ましいオフセット
 * @param {number} screen  画面サイズ（幅 or 高さ）
 * @param {number} mapPx   地図のピクセルサイズ
 * @returns {number}
 */
function clampCamera(desired, screen, mapPx) {
  if (mapPx <= screen) return Math.round((screen - mapPx) / 2);
  var min = screen - mapPx; // 負の値（地図右/下端を画面端に合わせる下限）
  var max = 0;
  if (desired < min) return min;
  if (desired > max) return max;
  return desired;
}

// ── シーンファクトリ ────────────────────────────────────────────────

/**
 * createFieldScene: フィールド探索シーンを生成して返す。
 * @param {Object} state GameState（position / flags / inventory を読み書きする）
 * @returns シーンオブジェクト { update, draw }（opaque）
 */
function createFieldScene(state) {
  var S = (typeof window !== 'undefined') ? window.SRPG : null;

  // ── マップ取得（ブラウザでは window.SRPG.MAPS、保険で field1 へフォールバック） ──
  var allMaps = (S && S.MAPS) ? S.MAPS : _maps();
  var pos = (state && state.position) || {};
  var map = allMaps[pos.map] || allMaps.field1;

  // ── プレイヤー状態 ───────────────────────────────────────────────
  var px = (pos.x !== undefined && pos.x !== null) ? pos.x : 5;
  var py = (pos.y !== undefined && pos.y !== null) ? pos.y : 5;
  var facing = 'down';
  var moveTimer = 0;

  // ── 宝箱の開封状態を flags から復元 ───────────────────────────────
  var opened = {};
  (map.chests || []).forEach(function (c) {
    opened[c.id] = !!(state.flags && state.flags['chest_' + c.id]);
  });

  // ── 定数 ─────────────────────────────────────────────────────────
  var TS = 32;            // タイルの仮想px（16pxスプライトを2倍）
  var STEP_TIME = 0.15;   // 1マス移動のクールダウン秒

  // ── 内部ヘルパ ───────────────────────────────────────────────────

  // facing 正面の NPC を返す（なければ null）
  function _npcAt(x, y) {
    var npcs = map.npcs || [];
    for (var i = 0; i < npcs.length; i++) {
      if (npcs[i].x === x && npcs[i].y === y) return npcs[i];
    }
    return null;
  }

  // facing 正面の未開封宝箱を返す（なければ null）
  function _chestAt(x, y) {
    var chests = map.chests || [];
    for (var i = 0; i < chests.length; i++) {
      var c = chests[i];
      if (c.x === x && c.y === y && !opened[c.id]) return c;
    }
    return null;
  }

  // 調べる/話す
  function _interact() {
    if (!S) return;
    var f = frontTile(px, py, facing);
    // NPC と会話
    var npc = _npcAt(f.x, f.y);
    if (npc) {
      S.pushScene(S.createDialog(npc.pages));
      return;
    }
    // 宝箱を開封
    var chest = _chestAt(f.x, f.y);
    if (chest) {
      opened[chest.id] = true;
      if (!state.flags) state.flags = {};
      state.flags['chest_' + chest.id] = true;
      if (!state.inventory) state.inventory = {};
      state.inventory[chest.item] = (state.inventory[chest.item] || 0) + chest.amount;
      S.saveGame(state);
      S.pushScene(S.createDialog([
        'たからばこを あけた！',
        chest.label + 'を てにいれた！',
      ]));
      return;
    }
  }

  // エンカウント抽選（draw 側の view レイヤなので Math.random 使用可・テスト対象外）
  function _maybeEncounter() {
    if (!map.encounter) return;
    if (Math.random() < map.encounter.rate) _triggerEncounter();
  }

  // バトルへ遷移（Task11 未実装ならダイアログのスタブ）
  function _triggerEncounter() {
    if (!S) return;
    if (typeof S.createBattleScene === 'function') {
      S.pushScene(S.createBattleScene(state, map.encounter.enemies));
    } else {
      S.pushScene(S.createDialog([
        'てきが あらわれた！',
        '（バトルは Task11 でつくるよ）',
      ]));
    }
  }

  return {
    update: function (dt, input) {
      if (!S) return;
      var pressed = (input && input.pressed) || {};
      var held    = (input && input.held)    || {};

      // 1. メニュー（cancel）
      if (pressed.cancel) {
        if (typeof S.createMenuScene === 'function') {
          S.pushScene(S.createMenuScene(state));
        } else {
          S.pushScene(S.createDialog(['メニューは Task12 でつくるよ']));
        }
        return;
      }

      // 2. 調べる/話す（confirm）
      if (pressed.confirm) {
        _interact();
        return;
      }

      // 3. 移動（held）
      moveTimer -= dt;
      if (moveTimer < 0) moveTimer = 0;

      var dir = held.up ? 'up'
              : held.down ? 'down'
              : held.left ? 'left'
              : held.right ? 'right'
              : null;

      if (!dir) { moveTimer = 0; return; }

      facing = dir;
      if (moveTimer > 0) return;

      var nt = frontTile(px, py, dir);
      if (isWalkable(map, nt.x, nt.y, opened)) {
        px = nt.x; py = nt.y;
        state.position.x = px;
        state.position.y = py;
        moveTimer = STEP_TIME;
        _maybeEncounter();
      } else {
        // 壁ドンの軽い間
        moveTimer = STEP_TIME * 0.7;
      }
    },

    draw: function (ctx) {
      if (!S) return;
      var VW = S.VW, VH = S.VH;

      // 1. 背景（地図外のはみ出し対策）
      ctx.fillStyle = '#0a0e1c';
      ctx.fillRect(0, 0, VW, VH);

      // 2. カメラ（プレイヤー中央・端でクランプ）
      var cols = map.grid[0].length, rows = map.grid.length;
      var mapW = cols * TS, mapH = rows * TS;
      var offX = clampCamera(Math.round(VW / 2 - (px * TS + TS / 2)), VW, mapW);
      var offY = clampCamera(Math.round(VH / 2 - (py * TS + TS / 2)), VH, mapH);

      // 3. タイル描画（可視範囲だけカリング）
      var legend = _tileLegend();
      var c0 = Math.max(0, Math.floor(-offX / TS));
      var c1 = Math.min(cols - 1, Math.floor((VW - offX) / TS));
      var r0 = Math.max(0, Math.floor(-offY / TS));
      var r1 = Math.min(rows - 1, Math.floor((VH - offY) / TS));
      for (var r = r0; r <= r1; r++) {
        var rowStr = map.grid[r];
        for (var c = c0; c <= c1; c++) {
          var t = legend[rowStr[c]];
          if (!t) continue;
          var sp = S.SPRITES[t.sprite];
          if (!sp) continue;
          S.drawSprite(ctx, sp, offX + c * TS, offY + r * TS, TS / 16);
        }
      }

      // 4. 宝箱（未開封のみ・簡易プリミティブ）
      var chests = map.chests || [];
      for (var ci = 0; ci < chests.length; ci++) {
        var ch = chests[ci];
        if (opened[ch.id]) continue;
        var sx = offX + ch.x * TS, sy = offY + ch.y * TS;
        ctx.fillStyle = '#8a5a2e'; ctx.fillRect(sx + 5, sy + 13, TS - 10, TS - 15);
        ctx.fillStyle = '#a86b34'; ctx.fillRect(sx + 5, sy + 9, TS - 10, 7);
        ctx.fillStyle = '#ffd76e';
        ctx.fillRect(sx + TS / 2 - 2, sy + 9, 4, TS - 12);
        ctx.fillRect(sx + 5, sy + 15, TS - 10, 3);
        ctx.strokeStyle = '#3a230f'; ctx.lineWidth = 1;
        ctx.strokeRect(sx + 5, sy + 9, TS - 10, TS - 13);
      }

      // 5. NPC
      var npcs = map.npcs || [];
      for (var ni = 0; ni < npcs.length; ni++) {
        var npc = npcs[ni];
        var nsp = S.SPRITES[npc.sprite];
        S.drawShadow(ctx, offX + npc.x * TS + TS / 2, offY + npc.y * TS + TS - 3, 10, 4);
        if (nsp) S.drawSprite(ctx, nsp, offX + npc.x * TS, offY + npc.y * TS, 1);
      }

      // 6. プレイヤー
      S.drawShadow(ctx, offX + px * TS + TS / 2, offY + py * TS + TS - 3, 11, 4);
      S.drawSprite(ctx, S.SPRITES.yuito, offX + px * TS, offY + py * TS, 1);

      // 7. ネームプレート（画面上部）
      S.drawWindow(ctx, VW / 2 - 60, 6, 120, 24, { radius: 8, border: '#5ec8ff' });
      S.drawText(ctx, map.name, VW / 2, 12, { size: 13, color: '#dff4ff', align: 'center' });
    },
  };
}

// ── UMD エクスポート ──────────────────────────────────────────────────
(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  createFieldScene: createFieldScene,
  frontTile:        frontTile,
  isWalkable:       isWalkable,
  clampCamera:      clampCamera,
});
