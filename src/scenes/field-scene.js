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
  // ソリッドな飾りオブジェクト（木/ゴール/ベンチ/看板/茂み）。
  //   objects 未定義のマップでも安全（|| [] で素通り）＝既存テストは無影響。
  var objects = map.objects || [];
  for (var o = 0; o < objects.length; o++) {
    var ob = objects[o];
    if (ob.solid && ob.x === x && ob.y === y) return false;
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

/**
 * _withActiveNpcs: vanishFlag が立っている NPC（加入済みの仲間・撃破済みのボス）を
 * 取り除いた表示用マップを返す。元マップは破壊せず npcs だけ差し替えた浅いクローン。
 * @param {Object} srcMap
 * @param {Object} flags state.flags
 * @returns {Object}
 */
function _withActiveNpcs(srcMap, flags) {
  if (!srcMap) return srcMap;
  flags = flags || {};
  var out = {};
  for (var k in srcMap) {
    if (Object.prototype.hasOwnProperty.call(srcMap, k)) out[k] = srcMap[k];
  }
  out.npcs = (srcMap.npcs || []).filter(function (n) {
    return !(n.vanishFlag && flags[n.vanishFlag]);
  });
  return out;
}

// ── 飾りオブジェクトの描画（宝箱と同じプロシージャル方式・view 層） ────────
//   AI差し替えフック：S.OBJ_ART['<type>'] に dataURL があれば drawImageSprite で
//   優先描画し、無ければベクター（fillRect/arc）で描く。obj-art.js を後から
//   足すだけでコード変更ゼロで AI 絵に切り替わる（WALK_ART と同じ思想）。
//   sx,sy = そのマスの左上スクリーン座標、TS = タイルpx。
function _drawFieldObject(ctx, S, type, sx, sy, TS, objArt) {
  // ① AI差し替え（在れば優先）
  if (objArt && objArt[type] && S && typeof S.drawImageSprite === 'function') {
    var aBoxH = (type === 'tree' || type === 'goal') ? TS * 1.6 : TS * 1.1;
    if (S.drawImageSprite(ctx, 'obj_' + type, objArt[type], sx + TS / 2, sy + TS - aBoxH / 2, aBoxH, false)) return;
  }

  // ② プロシージャル（ドット/ベクター）
  var cx = sx + TS / 2;       // マス中央X
  var by = sy + TS;           // マス下端（接地ライン）
  function blob(x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

  switch (type) {
    case 'tree': {
      ctx.fillStyle = '#7a4a22'; ctx.fillRect(cx - 3, by - 13, 6, 13);   // 幹
      ctx.fillStyle = '#5e3719'; ctx.fillRect(cx + 1, by - 13, 2, 13);   // 幹の陰
      blob(cx,     by - 26, 11, '#2f7d33');                              // 葉（暗）
      blob(cx - 7, by - 22, 8,  '#3a9a3f');
      blob(cx + 7, by - 22, 8,  '#3a9a3f');
      blob(cx,     by - 31, 10, '#54b94e');                              // 葉（明）
      blob(cx - 4, by - 27, 6,  '#6fd05f');                              // ハイライト
      break;
    }
    case 'bush': {
      blob(cx - 6, by - 5, 6, '#2f7d33');
      blob(cx + 6, by - 5, 6, '#2f7d33');
      blob(cx,     by - 8, 8, '#3a9a3f');
      blob(cx - 3, by - 9, 4, '#54b94e');
      blob(cx + 4, by - 7, 3, '#54b94e');
      ctx.fillStyle = '#256227'; ctx.fillRect(cx - 9, by - 2, 18, 3);    // 接地
      break;
    }
    case 'goal': {
      var gx = sx + 3, gy = sy + TS - 16, gw = TS - 6, gh = 14;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(gx + 2, gy + 2, gw - 4, gh - 2); // ネット面
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.beginPath();
      for (var nx = gx + 3; nx <= gx + gw - 3; nx += 4) { ctx.moveTo(nx, gy + 2); ctx.lineTo(nx, gy + gh); }
      for (var ny = gy + 4; ny <= gy + gh; ny += 4) { ctx.moveTo(gx + 2, ny); ctx.lineTo(gx + gw - 2, ny); }
      ctx.stroke();
      ctx.strokeStyle = '#f4f7ff'; ctx.lineWidth = 2.5; ctx.strokeRect(gx, gy, gw, gh); // 枠（白ポスト）
      ctx.restore();
      break;
    }
    case 'sign': {
      ctx.save();
      ctx.fillStyle = '#6e4422'; ctx.fillRect(cx - 1.5, by - 16, 3, 16);            // 支柱
      ctx.fillStyle = '#a86b34'; ctx.fillRect(cx - 9, by - 23, 18, 10);             // 板
      ctx.fillStyle = '#8a5524'; ctx.fillRect(cx - 9, by - 23, 18, 3);              // 上の陰
      ctx.strokeStyle = '#5e3719'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - 9, by - 23, 18, 10);
      ctx.strokeStyle = 'rgba(94,55,25,0.55)'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(cx - 9, by - 19); ctx.lineTo(cx + 9, by - 19);
      ctx.moveTo(cx - 9, by - 16); ctx.lineTo(cx + 9, by - 16); ctx.stroke();       // 板の継ぎ目
      ctx.restore();
      break;
    }
    case 'bench': {
      ctx.save();
      ctx.fillStyle = '#8a5a2e';
      ctx.fillRect(cx - 11, by - 13, 22, 3);   // 背もたれ
      ctx.fillRect(cx - 11, by - 8,  22, 4);   // 座面
      ctx.fillStyle = '#5e3719';
      ctx.fillRect(cx - 9, by - 8, 2, 8); ctx.fillRect(cx + 7, by - 8, 2, 8);       // 脚
      ctx.fillRect(cx - 9, by - 13, 2, 6); ctx.fillRect(cx + 7, by - 13, 2, 6);     // 背支柱
      ctx.restore();
      break;
    }
    case 'ball': {
      var br = 6, bcy = by - 7;
      ctx.save();
      blob(cx, bcy, br, '#ffffff');
      ctx.fillStyle = '#222831';
      ctx.beginPath(); ctx.arc(cx, bcy, 2.2, 0, Math.PI * 2); ctx.fill();           // 中央
      ctx.fillRect(cx - 5, bcy - 4, 2, 2); ctx.fillRect(cx + 3, bcy - 3, 2, 2); ctx.fillRect(cx - 1, bcy + 3, 2, 2);
      ctx.strokeStyle = '#222831'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, bcy, br, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'flower': {
      ctx.save();
      ctx.fillStyle = '#3a9a3f'; ctx.fillRect(cx - 6, by - 3, 12, 3);               // 草
      function fl(fx, fy, col) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(fx, fy, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(fx, fy, 1, 0, Math.PI * 2); ctx.fill();
      }
      fl(cx - 6, by - 5, '#ff6b6b'); fl(cx, by - 7, '#ffffff'); fl(cx + 6, by - 5, '#ffd23f');
      ctx.restore();
      break;
    }
    default: break;
  }
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
  var rawMap = allMaps[pos.map] || allMaps.field1;
  // 加入済み/撃破済みの NPC（vanishFlag が立っている）を除いた表示用マップ。
  // 元データは壊さず、npcs だけ差し替えた浅いクローンを使う。
  var map = _withActiveNpcs(rawMap, (state && state.flags) || {});

  // ── プレイヤー状態 ───────────────────────────────────────────────
  var px = (pos.x !== undefined && pos.x !== null) ? pos.x : 5;
  var py = (pos.y !== undefined && pos.y !== null) ? pos.y : 5;
  var facing = 'down';
  var moveTimer = 0;

  // ── 隊列（DQ風キャラバン）─────────────────────────────────────────
  //   state.party[0]=リーダー(ユイト/操作キャラ)、[1..]=後続の仲間。
  //   後続はリーダーが通った道を1マス遅れで辿る。シーン生成時はリーダーの
  //   マスに全員を重ねて開始し、歩き出すと自然にほどけて一列になる(DQ流)。
  //   マップ遷移で createFieldScene が作り直されるたび入口に再集合する。
  var party = (state && state.party) || [];
  var followers = [];   // [{id, x, y, facing}] リーダーを除く仲間
  for (var fi = 1; fi < party.length; fi++) {
    followers.push({ id: party[fi].id, x: px, y: py, facing: 'down' });
  }

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

  // (x,y) にある出口を返す（なければ null）
  function _exitAt(x, y) {
    var exits = map.exits || [];
    for (var i = 0; i < exits.length; i++) {
      if (exits[i].x === x && exits[i].y === y) return exits[i];
    }
    return null;
  }

  // NPC に話しかける（ショップ / 仲間加入 / ボス / 通常会話）
  function _talkTo(npc) {
    if (!S || !npc) return;

    // ① ショップ
    if (npc.shop) {
      if (typeof S.createShopScene === 'function') {
        S.pushScene(S.createShopScene(state, npc.shop));
      } else {
        S.pushScene(S.createDialog(npc.pages || ['みせは じゅんびちゅう…']));
      }
      return;
    }

    // ② 仲間加入
    if (npc.joinId) {
      var already = (state.party || []).some(function (p) { return p.id === npc.joinId; });
      if (already) {
        S.pushScene(S.createDialog(npc.afterPages || ['いっしょに がんばろう！']));
        return;
      }
      // 会話 → 加入処理 → 「○○が なかまになった！」→ フィールド再構築（NPC を消す）
      S.pushScene(S.createDialog(npc.pages, { onComplete: function () {
        var name = (typeof S.joinAlly === 'function') ? S.joinAlly(state, npc.joinId) : null;
        if (npc.vanishFlag) {
          if (!state.flags) state.flags = {};
          state.flags[npc.vanishFlag] = true;
        }
        if (S.saveGame) S.saveGame(state);
        S.pushScene(S.createDialog([(name || 'なかま') + ' が なかまに なった！'], { onComplete: function () {
          if (S.replaceScene) S.replaceScene(S.createFieldScene(state));
        } }));
      } }));
      return;
    }

    // ③ ボス（強制バトル）
    if (npc.boss) {
      var b = npc.boss;
      if (b.winFlag && state.flags && state.flags[b.winFlag]) {
        S.pushScene(S.createDialog(npc.afterPages || ['…もう てきは いない。']));
        return;
      }
      S.pushScene(S.createDialog(npc.pages, { onComplete: function () {
        S.pushScene(S.createBattleScene(state, null, {
          forced: b.enemies, winFlag: b.winFlag, vanishFlag: b.vanishFlag, ending: b.ending,
        }));
      } }));
      return;
    }

    // ④ 通常会話
    S.pushScene(S.createDialog(npc.pages));
  }

  // 調べる/話す
  function _interact() {
    if (!S) return;
    var f = frontTile(px, py, facing);
    // NPC と会話
    var npc = _npcAt(f.x, f.y);
    if (npc) {
      _talkTo(npc);
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

      // 出口（マップ移動）：踏み込む前に判定する
      var exit = _exitAt(nt.x, nt.y);
      if (exit) {
        if (exit.requireFlag && !(state.flags && state.flags[exit.requireFlag])) {
          // まだ開放されていない（ボス未撃破など）
          moveTimer = STEP_TIME * 0.7;
          S.pushScene(S.createDialog([exit.lockedMsg || 'まだ さきへは すすめないようだ…']));
          return;
        }
        // ワープしてフィールドを作り直す
        state.position.map = exit.to;
        state.position.x = exit.tx;
        state.position.y = exit.ty;
        if (S.saveGame) S.saveGame(state);
        if (S.replaceScene) S.replaceScene(S.createFieldScene(state));
        return;
      }

      if (isWalkable(map, nt.x, nt.y, opened)) {
        // 隊列を1マス分シフト：末尾から前へ詰め、先頭の仲間はリーダーが
        // 離れるマス(px,py)へ。進行方向 dir をその仲間の向きにする。
        for (var k = followers.length - 1; k >= 1; k--) {
          followers[k].x = followers[k - 1].x;
          followers[k].y = followers[k - 1].y;
          followers[k].facing = followers[k - 1].facing;
        }
        if (followers.length > 0) {
          followers[0].x = px;
          followers[0].y = py;
          followers[0].facing = dir;
        }
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
      var fieldArt = S.FIELD_ART || null;
      for (var r = r0; r <= r1; r++) {
        var rowStr = map.grid[r];
        for (var c = c0; c <= c1; c++) {
          var t = legend[rowStr[c]];
          if (!t) continue;
          var tx = offX + c * TS, ty = offY + r * TS;
          // AIテクスチャがあればマスを埋める。無い／未ロードならドット絵にフォールバック。
          var aurl = fieldArt && fieldArt[t.sprite];
          if (aurl && S.drawImageTile(ctx, 'field_' + t.sprite, aurl, tx, ty, TS)) continue;
          var sp = S.SPRITES[t.sprite];
          if (!sp) continue;
          S.drawSprite(ctx, sp, tx, ty, TS / 16);
        }
      }

      // 3.5 地面デカール（踏める飾り：ボール/花）。地面に貼るので全員の下に描く。
      var objArt = S.OBJ_ART || null;
      var groundObjs = map.objects || [];
      for (var gi = 0; gi < groundObjs.length; gi++) {
        var go = groundObjs[gi];
        if (go.type !== 'ball' && go.type !== 'flower') continue;
        if (go.x < c0 - 1 || go.x > c1 + 1 || go.y < r0 - 1 || go.y > r1 + 1) continue;
        _drawFieldObject(ctx, S, go.type, offX + go.x * TS, offY + go.y * TS, TS, objArt);
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

      // 6. パーティ隊列（後続の仲間＋先頭のユイト）。
      //    各キャラ：歩行AIスプライト(WALK_ART[id_dir])があれば向きで描画、
      //    無ければ従来ドット絵(SPRITES[id])へ自動フォールバック。
      //    足元Y昇順で描き、画面下にいる者ほど手前に重ねる(自然な重なり)。
      var actors = [];
      for (var ai = 0; ai < followers.length; ai++) {
        var fo = followers[ai];
        actors.push({ id: fo.id, x: fo.x, y: fo.y, facing: fo.facing, isLeader: false });
      }
      actors.push({
        id: (party[0] && party[0].id) || 'yuito',
        x: px, y: py, facing: facing, isLeader: true,
      });
      // ソリッド/背の高い飾り（木/ゴール/ベンチ/看板/茂み）も同じ Y ソートに混ぜる。
      //   画面下にいる者ほど手前＝プレイヤーが木の前に立てば木に隠れ、下なら手前。
      var solidObjs = map.objects || [];
      for (var soi = 0; soi < solidObjs.length; soi++) {
        var sob = solidObjs[soi];
        if (sob.type === 'ball' || sob.type === 'flower') continue; // 地面デカールは描画済み
        actors.push({ kind: 'object', objType: sob.type, x: sob.x, y: sob.y, isLeader: false });
      }
      actors.sort(function (a, b) {
        if (a.y !== b.y) return a.y - b.y;
        // 同 Y：飾りは奥、その次に仲間、リーダーが最前
        var ra = (a.kind === 'object') ? -1 : (a.isLeader ? 1 : 0);
        var rb = (b.kind === 'object') ? -1 : (b.isLeader ? 1 : 0);
        return ra - rb;
      });

      var walkArt = S.WALK_ART || null;
      for (var pi = 0; pi < actors.length; pi++) {
        var act = actors[pi];
        // 飾りオブジェクト（背の高い/ソリッド）：影＋プロシージャル描画
        if (act.kind === 'object') {
          var osx = offX + act.x * TS, osy = offY + act.y * TS;
          var oRx = (act.objType === 'tree') ? 8
                  : (act.objType === 'goal' || act.objType === 'bench') ? 12 : 9;
          S.drawShadow(ctx, osx + TS / 2, osy + TS - 3, oRx, 4);
          _drawFieldObject(ctx, S, act.objType, osx, osy, TS, objArt);
          continue;
        }
        var footCX = offX + act.x * TS + TS / 2;       // マス中央
        var footBottom = offY + act.y * TS + TS;       // マス下端＝接地点
        S.drawShadow(ctx, footCX, offY + act.y * TS + TS - 3, act.isLeader ? 11 : 10, 4);
        var drew = false;
        if (walkArt) {
          // 横向き(side)は右向き素材を基準にし、左移動時は左右反転で使い回す。
          var dKey = act.id + ((act.facing === 'up') ? '_up'
                            : (act.facing === 'down') ? '_down'
                            : '_side');
          var fl = (act.facing === 'left');
          var wu = walkArt[dKey];
          if (wu) {
            var bH = TS * 1.35;                          // タイルより少し大きい存在感
            drew = S.drawImageSprite(ctx, 'walk_' + dKey, wu, footCX, footBottom - bH / 2 + 2, bH, fl);
          }
        }
        if (!drew) {
          var dotSp = S.SPRITES[act.id] || S.SPRITES.yuito;
          S.drawSprite(ctx, dotSp, offX + act.x * TS, offY + act.y * TS, 1);
        }
      }

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
