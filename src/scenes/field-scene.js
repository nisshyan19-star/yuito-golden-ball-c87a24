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
 * pendingCutscene: このマップに入った瞬間に再生すべきカットシーン（イベント）を返す。
 *   map.cutscene = { flag?:string, pages:[...] } を見て、
 *   ・cutscene が無い／pages 空 → null（イベントなし）
 *   ・flag 指定があり既に立っている → null（再生済みなので二度は出さない）
 *   ・それ以外 → cutscene を返す（呼び出し側で flag を立て、ダイアログを出す）。
 * 純粋関数（state を書き換えない）なので node でもそのままテストできる。
 * @param {Object} map   rawMap（cutscene を持つ元データ）
 * @param {Object} flags state.flags
 * @returns {Object|null}
 */
function pendingCutscene(map, flags) {
  flags = flags || {};
  var cs = map && map.cutscene;
  if (!cs || !cs.pages || !cs.pages.length) return null;
  if (cs.flag && flags[cs.flag]) return null;
  return cs;
}

// ── マップギミック（弾2）：純粋関数（テスト対象） ─────────────────────

/**
 * warpAt: (x,y) にワープパネル（落とし穴・転送マス含む）があれば返す。なければ null。
 *   warp = { x, y, to?, tx, ty, msg? }
 *     to 省略 → 同マップ内の (tx,ty) へ再配置（落とし穴・近道）
 *     to 指定 → 別マップ to の (tx,ty) へ移動（シーン再構築）
 *   ※ to のワープ先 (tx,ty) には別のワープを置かない（連鎖暴走を設計で回避）。
 * @returns {Object|null}
 */
function warpAt(map, x, y) {
  var warps = (map && map.warps) || [];
  for (var i = 0; i < warps.length; i++) {
    if (warps[i].x === x && warps[i].y === y) return warps[i];
  }
  return null;
}

/**
 * conveyorAt: (x,y) に動く床（ベルトコンベア）があれば返す。なければ null。
 *   conveyor = { x, y, dir } … 乗ると dir 方向へ自動で1マスずつ流される。
 * @returns {Object|null}
 */
function conveyorAt(map, x, y) {
  var conv = (map && map.conveyors) || [];
  for (var i = 0; i < conv.length; i++) {
    if (conv[i].x === x && conv[i].y === y) return conv[i];
  }
  return null;
}

/**
 * puzzleSolved: すべての goal の上に block が乗っていれば true（倉庫番クリア判定）。
 *   blocks / goals = [{x,y}...]。goal が空なら false（パズル未設定は未解決扱い）。
 * @returns {boolean}
 */
function puzzleSolved(blocks, goals) {
  blocks = blocks || [];
  goals = goals || [];
  if (!goals.length) return false;
  for (var g = 0; g < goals.length; g++) {
    var hit = false;
    for (var b = 0; b < blocks.length; b++) {
      if (blocks[b].x === goals[g].x && blocks[b].y === goals[g].y) { hit = true; break; }
    }
    if (!hit) return false;
  }
  return true;
}

/**
 * tryPushBlock: (px,py) の正面 dir にある押しブロック（ボール）を押せるか判定する。
 *   戻り値:
 *     null                           … 正面にブロックは無い（＝通常移動の判定へ）
 *     { pushable:false }             … ブロックはあるが押せない（壁ドン）
 *     { pushable:true, index, x, y } … 押せる（blocks[index] を (x,y) へ動かす）
 *   押せる条件＝押し先が isWalkable かつ 他ブロック無し かつ ワープ無し。
 * @param {Object} map
 * @param {Array}  blocks [{x,y}...]（シーン局所の現在位置）
 * @param {number} px @param {number} py @param {string} dir
 * @param {Object} [opened]
 * @returns {Object|null}
 */
function tryPushBlock(map, blocks, px, py, dir, opened) {
  blocks = blocks || [];
  var front = frontTile(px, py, dir);
  var idx = -1;
  for (var i = 0; i < blocks.length; i++) {
    if (blocks[i].x === front.x && blocks[i].y === front.y) { idx = i; break; }
  }
  if (idx < 0) return null;
  var dest = frontTile(front.x, front.y, dir);
  if (!isWalkable(map, dest.x, dest.y, opened)) return { pushable: false };
  for (var j = 0; j < blocks.length; j++) {
    if (j !== idx && blocks[j].x === dest.x && blocks[j].y === dest.y) return { pushable: false };
  }
  if (warpAt(map, dest.x, dest.y)) return { pushable: false };
  return { pushable: true, index: idx, x: dest.x, y: dest.y };
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
    // 仲間は n.vanishFlag（トップレベル）、ボスは n.boss.vanishFlag（ネスト）に持つ。
    // 両方を見ないと、撃破したボスが消えず通路を塞ぎ続ける（回帰バグの原因だった）。
    var vf = n.vanishFlag || (n.boss && n.boss.vanishFlag);
    return !(vf && flags[vf]);
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

// ── ギミックの地面マーカー描画（弾2・view 層） ───────────────────────────
//   sx,sy = そのマスの左上スクリーン座標、TS = タイルpx、t = 経過時間っぽい位相。

// ワープパネル：紫の渦巻く魔法陣。踏むと転送される目印。
function _drawWarpPanel(ctx, sx, sy, TS, phase) {
  var cx = sx + TS / 2, cy = sy + TS / 2;
  ctx.save();
  var grd = ctx.createRadialGradient(cx, cy, 1, cx, cy, TS * 0.46);
  grd.addColorStop(0, 'rgba(214,170,255,0.95)');
  grd.addColorStop(0.5, 'rgba(150,90,230,0.65)');
  grd.addColorStop(1, 'rgba(70,30,120,0.05)');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(cx, cy, TS * 0.44, 0, Math.PI * 2); ctx.fill();
  // 回る三本の弧
  ctx.strokeStyle = 'rgba(245,225,255,0.85)'; ctx.lineWidth = 2;
  for (var a = 0; a < 3; a++) {
    var base = phase + a * (Math.PI * 2 / 3);
    ctx.beginPath();
    ctx.arc(cx, cy, TS * 0.30, base, base + Math.PI * 0.9);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// 動く床（ベルトコンベア）：向き dir の矢印が並ぶ床。
function _drawConveyor(ctx, sx, sy, TS, dir) {
  var cx = sx + TS / 2, cy = sy + TS / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(90,120,170,0.5)';
  ctx.fillRect(sx + 2, sy + 2, TS - 4, TS - 4);
  ctx.strokeStyle = 'rgba(180,210,255,0.55)'; ctx.lineWidth = 1;
  // 床の溝（3本）
  for (var i = 1; i <= 3; i++) {
    var p = sy + (TS * i / 4);
    if (dir === 'left' || dir === 'right') { p = sx + (TS * i / 4); ctx.beginPath(); ctx.moveTo(p, sy + 3); ctx.lineTo(p, sy + TS - 3); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(sx + 3, p); ctx.lineTo(sx + TS - 3, p); ctx.stroke(); }
  }
  // 進行方向の矢印（白）
  ctx.fillStyle = 'rgba(235,245,255,0.9)';
  ctx.beginPath();
  if (dir === 'down')      { ctx.moveTo(cx, cy + 7); ctx.lineTo(cx - 6, cy - 3); ctx.lineTo(cx + 6, cy - 3); }
  else if (dir === 'up')   { ctx.moveTo(cx, cy - 7); ctx.lineTo(cx - 6, cy + 3); ctx.lineTo(cx + 6, cy + 3); }
  else if (dir === 'left') { ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 3, cy - 6); ctx.lineTo(cx + 3, cy + 6); }
  else                     { ctx.moveTo(cx + 7, cy); ctx.lineTo(cx - 3, cy - 6); ctx.lineTo(cx - 3, cy + 6); }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// パズルのゴール印：金色の点線わく（ここにボールを入れる）。
function _drawGoalMark(ctx, sx, sy, TS, filled) {
  ctx.save();
  ctx.strokeStyle = filled ? 'rgba(120,230,150,0.95)' : 'rgba(255,214,110,0.95)';
  ctx.lineWidth = 2;
  if (ctx.setLineDash) ctx.setLineDash([4, 3]);
  ctx.strokeRect(sx + 5, sy + 5, TS - 10, TS - 10);
  if (ctx.setLineDash) ctx.setLineDash([]);
  ctx.fillStyle = filled ? 'rgba(120,230,150,0.18)' : 'rgba(255,214,110,0.14)';
  ctx.fillRect(sx + 6, sy + 6, TS - 12, TS - 12);
  ctx.restore();
}

// 押しブロック＝白いサッカーボール（黒五角形入り）。actor として Y ソート描画。
function _drawPushBall(ctx, sx, sy, TS) {
  var cx = sx + TS / 2, cy = sy + TS / 2;
  var r = TS * 0.36;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2a2f3a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  // 中央の黒五角形
  ctx.fillStyle = '#2a2f3a';
  ctx.beginPath();
  for (var k = 0; k < 5; k++) {
    var ang = -Math.PI / 2 + k * (Math.PI * 2 / 5);
    var rx = cx + Math.cos(ang) * r * 0.42, ry = cy + Math.sin(ang) * r * 0.42;
    if (k === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
  }
  ctx.closePath(); ctx.fill();
  // 周りの黒い継ぎ目（簡易）
  for (var m = 0; m < 5; m++) {
    var a2 = -Math.PI / 2 + m * (Math.PI * 2 / 5) + Math.PI / 5;
    ctx.fillRect(cx + Math.cos(a2) * r * 0.78 - 1, cy + Math.sin(a2) * r * 0.78 - 1, 2.4, 2.4);
  }
  ctx.restore();
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

  // このマップ入場時に一度だけ流すカットシーン（イベント・弾4）。
  // update の最初に未再生なら再生する。再生したら flag を立てて二度は出さない。
  var _cutscene = pendingCutscene(rawMap, (state && state.flags) || {});

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
  var followers = [];   // [{id, x, y, facing, isMonster, baseId}] リーダーを除く仲間
  for (var fi = 1; fi < party.length; fi++) {
    followers.push({
      id: party[fi].id, x: px, y: py, facing: 'down',
      isMonster: party[fi].isMonster, baseId: party[fi].baseId,
    });
  }

  // ── 宝箱の開封状態を flags から復元 ───────────────────────────────
  var opened = {};
  (map.chests || []).forEach(function (c) {
    opened[c.id] = !!(state.flags && state.flags['chest_' + c.id]);
  });

  // ── 定数 ─────────────────────────────────────────────────────────
  var TS = 32;            // タイルの仮想px（16pxスプライトを2倍）
  var STEP_TIME = 0.15;   // 1マス移動のクールダウン秒
  var ENCOUNTER_GRACE = 3; // 戦闘直後/マップ入場後この歩数は必ず安全（連戦・事故エンカ防止）

  // エンカウント抽選用：直近の戦闘からの歩数。createFieldScene のクロージャに
  // 紐づくのでランダム戦闘(pushScene)をまたいでも保持され、マップ遷移で
  // シーンが作り直されると 0 に戻る（＝入場直後も必ず ENCOUNTER_GRACE 歩は安全）。
  var stepsSinceBattle = 0;

  // ── 押しパズル（弾2・倉庫番）の状態 ───────────────────────────────
  //   map.pushBlocks / map.pushGoals = [{x,y}...]、map.pushPuzzle = {solveFlag, clearMsg}。
  //   既に解いている(flag 済み)場合は、再入場時にブロックをゴール上へ置いて
  //   「解けた状態」を再現する（requireFlag 宝箱も開けたままで矛盾しない）。
  var pushGoals = (map.pushGoals || []).map(function (g) { return { x: g.x, y: g.y }; });
  var pushBlocks;
  var _solvedFlag = map.pushPuzzle && map.pushPuzzle.solveFlag;
  if (_solvedFlag && state.flags && state.flags[_solvedFlag] && pushGoals.length) {
    pushBlocks = pushGoals.map(function (g) { return { x: g.x, y: g.y }; });
  } else {
    pushBlocks = (map.pushBlocks || []).map(function (b) { return { x: b.x, y: b.y }; });
  }

  // ワープパネルの渦アニメ用の位相（draw ごとに少しずつ回す・見た目だけ）。
  var _gfx = 0;

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

    // ①-2 かじや（追加弾5-D）：そざい＋ゴールドで そうびを ごうせい。
    if (npc.forge) {
      if (typeof S.createForgeScene === 'function') S.pushScene(S.createForgeScene(state, npc.forge));
      else S.pushScene(S.createDialog(['かじやは じゅんびちゅう…']));
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
          forced: b.enemies, winFlag: b.winFlag, vanishFlag: b.vanishFlag,
          ending: b.ending, reward: b.reward,
        }));
      } }));
      return;
    }

    // ③-2 ボスラッシュ（追加弾4-D）：「ちょうせんの間」。これまでのボスと れんぞくバトル。
    //     とちゅうで HP/MP は かいふく しない（戦闘間で引き継ぐ）。全部 たおすと
    //     winFlag を立てて 一度きりの トロフィー報酬を わたす（2回目以降は ごほうび無し）。
    if (npc.bossRush) {
      var br = npc.bossRush;
      var brCleared = !!(br.winFlag && state.flags && state.flags[br.winFlag]);
      var brIntro = brCleared
        ? (npc.afterPages || ['また ちょうせん するかい？', 'いつでも おいで！'])
        : (npc.pages || ['ボスラッシュに ちょうせん する？', 'とちゅうで かいふく できないぞ！']);
      S.pushScene(S.createDialog(brIntro, { onComplete: function () { _startBossRush(br); } }));
      return;
    }

    // ④ サブクエスト（依頼主）：受注→（別NPCで品物入手）→報酬、の一本道。
    if (npc.quest) {
      var q = npc.quest;
      var flags = state.flags || {};
      var stage = (typeof S.questStage === 'function') ? S.questStage(q, flags) : 'ask';

      if (stage === 'done') {
        S.pushScene(S.createDialog(q.donePages || ['ほんとうに ありがとう！']));
        return;
      }
      if (stage === 'wait') {
        S.pushScene(S.createDialog(q.waitPages || ['たのんだ こと、まだかな？']));
        return;
      }
      if (stage === 'clear') {
        // 品物を持って戻ってきた → 報酬を渡して doneFlag を立てる。
        S.pushScene(S.createDialog(q.clearPages || ['おお！ ありがとう！'], { onComplete: function () {
          var summary = (typeof S.grantReward === 'function') ? S.grantReward(state, q.reward) : '';
          if (!state.flags) state.flags = {};
          if (q.doneFlag) state.flags[q.doneFlag] = true;
          if (S.saveGame) S.saveGame(state);
          var msg = summary ? ('おれいに ' + summary + 'を もらった！') : 'おれいを もらった！';
          S.pushScene(S.createDialog([msg]));
        } }));
        return;
      }
      // stage === 'ask'：依頼を受ける（acceptFlag を立てる）。
      S.pushScene(S.createDialog(q.askPages || ['おつかいを たのめるかな？'], { onComplete: function () {
        if (!state.flags) state.flags = {};
        if (q.acceptFlag) state.flags[q.acceptFlag] = true;
        if (S.saveGame) S.saveGame(state);
      } }));
      return;
    }

    // ⑤ おつかいの受け渡し相手：受注済みなら品物を渡す（itemFlag を立てる）。
    if (npc.give) {
      var gv = npc.give;
      var gf = state.flags || {};
      if (gv.itemFlag && gf[gv.itemFlag]) {
        S.pushScene(S.createDialog(gv.gotPages || ['もう わたしたよ。きを つけてね。']));
        return;
      }
      if (gv.requireFlag && !gf[gv.requireFlag]) {
        // まだ依頼を受けていない＝ふつうの世間話。
        S.pushScene(S.createDialog(gv.idlePages || npc.pages || ['こんにちは。']));
        return;
      }
      S.pushScene(S.createDialog(gv.pages || ['これを とどけて あげて。はい どうぞ！'], { onComplete: function () {
        if (!state.flags) state.flags = {};
        if (gv.itemFlag) state.flags[gv.itemFlag] = true;
        if (S.saveGame) S.saveGame(state);
      } }));
      return;
    }

    // ⑥ 仕掛け（弾3）：スイッチ。おすと flag を立てて 宝箱などを ひらく。
    if (npc.lever) {
      var lv = npc.lever;
      var lf = state.flags || {};
      if (lv.flag && lf[lv.flag]) {
        S.pushScene(S.createDialog(lv.donePages || ['もう うごかした あとだ。']));
        return;
      }
      S.pushScene(S.createDialog(lv.onPages || ['スイッチを おした！'], { onComplete: function () {
        if (!state.flags) state.flags = {};
        if (lv.flag) state.flags[lv.flag] = true;
        if (S.saveGame) S.saveGame(state);
      } }));
      return;
    }

    // ⑦ PK戦ミニゲーム（追加弾3）：コーチに話すと PK戦（5本勝負）に ちょうせんできる。
    //    勝つと winFlag を立てて 報酬を渡す（実績 pk_master 解除につながる）。2回目以降は ごほうび無し。
    if (npc.pk) {
      var pk = npc.pk;
      var pkFlags = state.flags || {};
      var pkWonBefore = !!(pk.winFlag && pkFlags[pk.winFlag]);
      var introPages = pkWonBefore ? (npc.afterPages || ['また PKせんで あそぼう！']) : (npc.pages || ['PKせんに ちょうせん する？']);
      S.pushScene(S.createDialog(introPages, { onComplete: function () {
        S.pushScene(S.createPkScene(state, { onComplete: function (win, goals) {
          if (win && !pkWonBefore) {
            if (!state.flags) state.flags = {};
            if (pk.winFlag) state.flags[pk.winFlag] = true;
            var summary = (pk.reward && typeof S.grantReward === 'function') ? S.grantReward(state, pk.reward) : '';
            if (S.saveGame) S.saveGame(state);
            var msg = summary ? ('かった！ ' + goals + 'てん！\nごほうびに ' + summary + 'を もらった！') : ('かった！ ' + goals + 'てん！');
            S.pushScene(S.createDialog([msg]));
          } else if (win) {
            S.pushScene(S.createDialog(['また かった！ ' + goals + 'てん！\nみごとな うでまえだ！']));
          } else {
            S.pushScene(S.createDialog(['ざんねん… ' + goals + 'てん。\nまた ちょうせんしてね！']));
          }
        } }));
      } }));
      return;
    }

    // ⑦.5 サッカー トーナメント（追加弾5-C）：主催者に話すと 3チーム勝ち抜きの トーナメントに ちょうせん。
    //    requireFlag（pk_master）未達なら ろっくメッセージ。ゆうしょうで winFlag＋トロフィー報酬＋実績/称号。
    //    2回目以降は ごほうび無しで 何度でも あそべる。
    if (npc.tournament) {
      var tn = npc.tournament;
      var tnFlags = state.flags || {};
      if (tn.requireFlag && !tnFlags[tn.requireFlag]) {
        S.pushScene(S.createDialog(npc.lockedPages || ['まずは PKコーチで うでを みがいてから おいで！']));
        return;
      }
      var tnWonBefore = !!(tn.winFlag && tnFlags[tn.winFlag]);
      var tnIntro = tnWonBefore ? (npc.afterPages || ['また トーナメントに ちょうせん するかい？']) : (npc.pages || ['トーナメントに ちょうせん する？']);
      S.pushScene(S.createDialog(tnIntro, { onComplete: function () {
        S.pushScene(S.createTournamentScene(state, { onComplete: function (champion, roundsWon) {
          if (champion && !tnWonBefore) {
            if (!state.flags) state.flags = {};
            if (tn.winFlag) state.flags[tn.winFlag] = true;
            var summary = (tn.reward && typeof S.grantReward === 'function') ? S.grantReward(state, tn.reward) : '';
            var newAch = (typeof S.checkAchievements === 'function') ? S.checkAchievements(state) : [];
            if (S.saveGame) S.saveGame(state);
            var msg = summary ? ('ゆうしょう！！\nごほうびに ' + summary + 'を もらった！') : 'ゆうしょう！！';
            var pages = [msg];
            if (newAch && newAch.length) pages.push('じっせき「' + newAch[0].name + '」を かいきん！');
            S.pushScene(S.createDialog(pages));
          } else if (champion) {
            S.pushScene(S.createDialog(['また ゆうしょう！\nきみは ほんとうに つよいな！']));
          } else {
            S.pushScene(S.createDialog(['ざんねん… ' + roundsWon + 'かいせん とっぱ。\nまた ちょうせん してね！']));
          }
        } }));
      } }));
      return;
    }

    // ⑧ 通常会話
    S.pushScene(S.createDialog(npc.pages));
  }

  // ボスラッシュ本体（追加弾4-D）。歴代ボスと れんぞくで たたかう「ちょうせんの間」。
  //   ・はじめに 一度だけ 全回復（フェアに スタート）。
  //   ・戦闘間は かいふく せず HP/MP を 引き継ぐ（createBattleScene は state.party を そのまま使う）。
  //   ・各戦闘は winFlag/ending を持たせず onWin だけ渡す＝battle-scene の onWin ルートを通る。
  //     onWin の中で 勝ったバトルを popScene してから 次の戦闘へ つなぐ。
  //   ・全部 たおしたら 初回だけ winFlag＋トロフィー報酬を わたして 保存する。
  //   ・まけたら _onDefeat が立て直して popScene＝チェーンが切れて 部屋に もどる（NPC再挑戦でリトライ）。
  function _startBossRush(br) {
    var seq = (br && br.enemies) || [];
    var already = !!(br.winFlag && state.flags && state.flags[br.winFlag]);
    // フェアな開始：一度だけ全回復（ここから先は かいふく しない）。
    if (typeof S.healParty === 'function') S.healParty(state.party);

    function bossName(id) {
      return (S.ENEMIES && S.ENEMIES[id] && S.ENEMIES[id].name) || 'つよてき';
    }

    function clear() {
      var pages = ['すべての ボスを たおした！', 'きみは ほんとうの チャンピオンだ！'];
      if (!already) {
        if (!state.flags) state.flags = {};
        if (br.winFlag) state.flags[br.winFlag] = true;
        var summary = (br.reward && typeof S.grantReward === 'function') ? S.grantReward(state, br.reward) : '';
        if (summary) pages.push('ごほうびに ' + summary + 'を もらった！');
        if (S.saveGame) S.saveGame(state);
      }
      S.pushScene(S.createDialog(pages));
    }

    function fight(i) {
      if (i >= seq.length) { clear(); return; }
      S.pushScene(S.createBattleScene(state, null, {
        forced: [seq[i]],
        onWin: function () {
          S.popScene(); // 勝ったバトルを抜ける（_showMessages は内部 _msg なので自分で pop）
          if (i === seq.length - 1) { fight(i + 1); return; }
          S.pushScene(S.createDialog([
            bossName(seq[i]) + 'を たおした！',
            'つぎは ' + bossName(seq[i + 1]) + 'だ！\n（HP・MPは かいふく しないぞ！）',
          ], { onComplete: function () { fight(i + 1); } }));
        },
      }));
    }

    fight(0);
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
      // 仕掛け錠（弾3）：requireFlag が立つまで ひらかない。
      if (chest.requireFlag && !(state.flags && state.flags[chest.requireFlag])) {
        S.pushScene(S.createDialog([
          chest.lockedMsg || 'カギが かかっている…',
        ]));
        return;
      }
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
    if (stepsSinceBattle < ENCOUNTER_GRACE) return; // 直近の戦闘/入場からの猶予歩数中は出ない
    if (Math.random() < map.encounter.rate) _triggerEncounter();
  }

  // バトルへ遷移（Task11 未実装ならダイアログのスタブ）
  function _triggerEncounter() {
    if (!S) return;
    stepsSinceBattle = 0; // 戦闘に入ったら歩数をリセット → 連戦を防ぐ
    if (typeof S.createBattleScene === 'function') {
      // レアモンスター抽選：rare.rate で当たったら rare.enemies を1体だけ強制出現（forced）
      const rare = map.encounter.rare;
      if (rare && rare.enemies && rare.enemies.length && Math.random() < (rare.rate || 0)) {
        S.pushScene(S.createBattleScene(state, map.encounter.enemies, { forced: rare.enemies }));
      } else {
        S.pushScene(S.createBattleScene(state, map.encounter.enemies));
      }
    } else {
      S.pushScene(S.createDialog([
        'てきが あらわれた！',
        '（バトルは Task11 でつくるよ）',
      ]));
    }
  }

  // ── ギミック用ヘルパ（弾2） ──────────────────────────────────────────

  // (x,y) に押しブロックがあるか
  function _blockAt(x, y) {
    for (var i = 0; i < pushBlocks.length; i++) {
      if (pushBlocks[i].x === x && pushBlocks[i].y === y) return true;
    }
    return false;
  }

  // リーダーを (nx,ny) へ1マス進める（隊列を1マス分シフト）。通常移動・押し・
  // コンベア流れ で共通利用。dir は先頭の仲間の向きに使う。
  function _stepLeaderTo(nx, ny, dir) {
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
    px = nx; py = ny;
    state.position.x = px;
    state.position.y = py;
    moveTimer = STEP_TIME;
  }

  // リーダーを (nx,ny) へ瞬間移動（ワープ）。隊列はリーダーに一度集合させ、
  // 歩き出すと自然にほどける（マップ入場時と同じ DQ 流）。
  function _setLeaderPos(nx, ny) {
    px = nx; py = ny;
    for (var k = 0; k < followers.length; k++) {
      followers[k].x = px; followers[k].y = py; followers[k].facing = facing;
    }
    state.position.x = px;
    state.position.y = py;
  }

  // 押しパズルが解けたか判定し、解けていれば flag を立てて知らせる。
  function _checkPuzzle() {
    var pp = map.pushPuzzle;
    if (!pp || !pp.solveFlag) return;
    if (state.flags && state.flags[pp.solveFlag]) return;     // 既に解決済み
    if (!puzzleSolved(pushBlocks, pushGoals)) return;
    if (!state.flags) state.flags = {};
    state.flags[pp.solveFlag] = true;
    if (S.saveGame) S.saveGame(state);
    S.pushScene(S.createDialog([pp.clearMsg || 'カチッ。なにかが ひらいた おとが した！']));
  }

  // ワープ実行：別マップなら遷移、同マップなら (tx,ty) へテレポート。
  function _doWarp(w) {
    function go() {
      if (w.to) {
        state.position.map = w.to;
        state.position.x = w.tx;
        state.position.y = w.ty;
        if (S.saveGame) S.saveGame(state);
        if (S.replaceScene) S.replaceScene(S.createFieldScene(state));
      } else {
        _setLeaderPos(w.tx, w.ty);
        if (S.saveGame) S.saveGame(state);
      }
    }
    if (w.msg) S.pushScene(S.createDialog([w.msg], { onComplete: go }));
    else go();
  }

  // 足元のタイル効果（ワープ／動く床）を適用する。
  //   戻り値: 何か作用したら true（＝この歩ではエンカウントを回さない）。
  //   無限連鎖は guard で抑止（同マップワープ先・コンベア先は安全設計）。
  function _applyTileEffects() {
    var guard = 0;
    var acted = false;
    while (guard++ < 12) {
      var w = warpAt(map, px, py);
      if (w) { _doWarp(w); return true; }   // ワープは即終了（遷移 or テレポート）
      var cv = conveyorAt(map, px, py);
      if (cv) {
        var slide = frontTile(px, py, cv.dir);
        if (isWalkable(map, slide.x, slide.y, opened) && !_blockAt(slide.x, slide.y)) {
          _stepLeaderTo(slide.x, slide.y, cv.dir);
          acted = true;
          continue;                          // 次のマスも流れるか再評価
        }
        return acted;                        // 流れ先が壁/ブロック → 止まる
      }
      return acted;                          // 何もなし → 終了
    }
    return acted;
  }

  return {
    update: function (dt, input) {
      if (!S) return;

      // 0. カットシーン（イベント・弾4）：このマップ入場時に一度だけ再生。
      //    flag を立てて saveGame し、ダイアログを積む（入力より先に処理）。
      if (_cutscene) {
        var cs = _cutscene;
        _cutscene = null;
        if (!state.flags) state.flags = {};
        if (cs.flag) state.flags[cs.flag] = true;
        if (S.saveGame) S.saveGame(state);
        S.pushScene(S.createDialog(cs.pages));
        return;
      }

      // 0.5 実績チェック（追加弾3・やりこみ）：フィールドに戻る/歩くたびに判定。
      //     新しく解除されたものがあれば お知らせダイアログを出す。
      //     checkAchievements はべき等（2回目以降は [] を返す）なので無限ループしない。
      if (S.checkAchievements) {
        var newAch = S.checkAchievements(state);
        if (newAch && newAch.length) {
          if (S.saveGame) S.saveGame(state);
          S.pushScene(S.createDialog(newAch.map(function (a) {
            return 'じっせき かいじょ！\n★「' + a.name + '」\n' + a.desc;
          })));
          return;
        }
      }

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

      // 押しブロック（サッカーボール）を押す（弾2・倉庫番）。
      //   正面にブロックがあれば通常移動より先に処理する＝プレイヤーは
      //   ブロックのマスへは決して踏み込まない（後続もリーダーを辿るだけ）。
      var push = tryPushBlock(map, pushBlocks, px, py, dir, opened);
      if (push) {
        if (push.pushable) {
          pushBlocks[push.index].x = push.x;
          pushBlocks[push.index].y = push.y;
          _stepLeaderTo(nt.x, nt.y, dir);
          stepsSinceBattle++;
          _checkPuzzle();          // 全ゴールに乗ったら解錠
          _applyTileEffects();     // 押した先がワープ/コンベアなら作用
        } else {
          moveTimer = STEP_TIME * 0.7; // ブロックの先が壁＝動かせない
        }
        return;
      }

      if (isWalkable(map, nt.x, nt.y, opened)) {
        _stepLeaderTo(nt.x, nt.y, dir);
        stepsSinceBattle++;
        // 足元のタイル効果（ワープ/動く床）を適用。何か作用したら
        // その歩ではエンカウントを回さない（事故エンカ防止）。
        if (!_applyTileEffects()) _maybeEncounter();
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

      // 3.6 ギミックの地面マーカー（弾2）：ワープパネル/動く床/パズルのゴール印。
      //      いずれも地面に貼るので全員の下（足元）に描く。可視範囲だけカリング。
      _gfx += 0.06;
      function _visible(gx, gy) { return !(gx < c0 - 1 || gx > c1 + 1 || gy < r0 - 1 || gy > r1 + 1); }
      var warpsD = map.warps || [];
      for (var wi = 0; wi < warpsD.length; wi++) {
        var wp = warpsD[wi];
        if (!_visible(wp.x, wp.y)) continue;
        _drawWarpPanel(ctx, offX + wp.x * TS, offY + wp.y * TS, TS, _gfx);
      }
      var convsD = map.conveyors || [];
      for (var cvi = 0; cvi < convsD.length; cvi++) {
        var cvD = convsD[cvi];
        if (!_visible(cvD.x, cvD.y)) continue;
        _drawConveyor(ctx, offX + cvD.x * TS, offY + cvD.y * TS, TS, cvD.dir);
      }
      for (var glp = 0; glp < pushGoals.length; glp++) {
        var gG = pushGoals[glp];
        if (!_visible(gG.x, gG.y)) continue;
        _drawGoalMark(ctx, offX + gG.x * TS, offY + gG.y * TS, TS, _blockAt(gG.x, gG.y));
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
        actors.push({
          id: fo.id, x: fo.x, y: fo.y, facing: fo.facing, isLeader: false,
          isMonster: fo.isMonster, baseId: fo.baseId,
        });
      }
      actors.push({
        id: (party[0] && party[0].id) || 'yuito',
        x: px, y: py, facing: facing, isLeader: true,
        isMonster: party[0] && party[0].isMonster, baseId: party[0] && party[0].baseId,
      });
      // ソリッド/背の高い飾り（木/ゴール/ベンチ/看板/茂み）も同じ Y ソートに混ぜる。
      //   画面下にいる者ほど手前＝プレイヤーが木の前に立てば木に隠れ、下なら手前。
      var solidObjs = map.objects || [];
      for (var soi = 0; soi < solidObjs.length; soi++) {
        var sob = solidObjs[soi];
        if (sob.type === 'ball' || sob.type === 'flower') continue; // 地面デカールは描画済み
        actors.push({ kind: 'object', objType: sob.type, x: sob.x, y: sob.y, isLeader: false });
      }
      // 押しブロック（サッカーボール）も Y ソートに混ぜる（弾2）。仲間と同列の
      // 重なり順＝下にいるほど手前。リーダーではないので isLeader:false。
      for (var pbi = 0; pbi < pushBlocks.length; pbi++) {
        var pbk = pushBlocks[pbi];
        actors.push({ kind: 'pushball', x: pbk.x, y: pbk.y, isLeader: false });
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
        // 押しブロック（サッカーボール）：影＋ボール本体（弾2）。
        if (act.kind === 'pushball') {
          var bsx = offX + act.x * TS, bsy = offY + act.y * TS;
          S.drawShadow(ctx, bsx + TS / 2, bsy + TS - 4, 9, 4);
          _drawPushBall(ctx, bsx, bsy, TS);
          continue;
        }
        var footCX = offX + act.x * TS + TS / 2;       // マス中央
        var footBottom = offY + act.y * TS + TS;       // マス下端＝接地点
        S.drawShadow(ctx, footCX, offY + act.y * TS + TS - 3, act.isLeader ? 11 : 10, 4);
        var drew = false;
        // なかまモンスター：歩行絵(WALK_ART)が無いので 戦闘立ち絵(ENEMY_ART[baseId])を
        //   向き反転/歩行コマ切替なしの 静止スプライトとして 隊列に置く。座標/サイズは
        //   人間キャラの歩行絵描画と同じ（footCX / footBottom / bH）。
        if (act.isMonster) {
          var artData = S.ENEMY_ART && S.ENEMY_ART[act.baseId];
          if (artData) {
            var mH = TS * 1.35;
            drew = S.drawImageSprite(ctx, 'monwalk_' + act.baseId, artData, footCX, footBottom - mH / 2 + 2, mH);
          }
        } else if (walkArt) {
          // 横向き(side)素材は全キャラ「左向き」で生成済み。右移動のときだけ左右反転して使い回す。
          var dKey = act.id + ((act.facing === 'up') ? '_up'
                            : (act.facing === 'down') ? '_down'
                            : '_side');
          var fl = (act.facing === 'right');
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

      // 6.5 暗闇オーバーレイ（弾2 dark マップ）：プレイヤー中心の「たいまつ視界」。
      //     ひみつの部屋など map.dark のときだけ、周囲をうっすら照らして探索感を出す。
      if (map.dark) {
        var tcx = offX + px * TS + TS / 2;
        var tcy = offY + py * TS + TS / 2;
        var torchR = TS * 4;
        var grad = ctx.createRadialGradient(tcx, tcy, TS * 0.6, tcx, tcy, torchR);
        grad.addColorStop(0,   'rgba(0,0,0,0)');
        grad.addColorStop(0.6, 'rgba(0,0,0,0.35)');
        grad.addColorStop(1,   'rgba(0,0,0,0.97)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VW, VH);
      }

      // 7. ネームプレート（画面上部）
      S.drawWindow(ctx, VW / 2 - 60, 6, 120, 24, { radius: 8, border: '#5ec8ff' });
      S.drawText(ctx, map.name, VW / 2, 12, { size: 13, color: '#dff4ff', align: 'center' });
    },
  };
}

/**
 * createPkScene — PK戦ミニゲーム（追加弾3）
 *   5本勝負で 3本きめたら勝ち。←ひだり ↑/けってい=まんなか →みぎ でシュート方向を選び、
 *   キーパーの飛ぶ方向（ランダム）と違えばゴール。純粋判定は S.pkResolve に委譲。
 * @param {object} state - ゲーム状態（このシーンは読み取りのみ・報酬付与は呼び出し側）
 * @param {{ onComplete?: function, maxShots?: number, winGoals?: number }} [opts]
 * @returns {object} シーン（update/draw/isDone/_debug）
 */
function createPkScene(state, opts) {
  opts = opts || {};
  var S = (typeof window !== 'undefined' ? window : globalThis).SRPG;
  var VW = S.VW, VH = S.VH;
  var DIRS = ['left', 'center', 'right'];
  var MAX_SHOTS = opts.maxShots || 5;
  var WIN_GOALS = opts.winGoals || 3;

  var _phase = 'aim';   // 'aim' | 'result' | 'done'
  var _shot = 0;        // 蹴った本数
  var _goals = 0;       // 決めた本数
  var _shootDir = null; // 今回のシュート方向
  var _keeperDir = null;// 今回のキーパーの飛び方向
  var _goal = false;    // 今回ゴールしたか
  var _timer = 0;       // result/done の経過時間
  var _done = false;

  function _keeperDive() {
    // キーパーはランダムに飛ぶ（ゲーム実行時の乱数は許容＝dialog.js 同様）。
    return DIRS[Math.floor(Math.random() * DIRS.length)];
  }

  function _kick(dir) {
    _shootDir = dir;
    _keeperDir = _keeperDive();
    _goal = S.pkResolve(dir, _keeperDir);
    if (_goal) _goals++;
    _shot++;
    _phase = 'result';
    _timer = 0;
  }

  function _finish() {
    if (_done) return;
    _done = true;
    var win = _goals >= WIN_GOALS;
    S.popScene();
    if (typeof opts.onComplete === 'function') opts.onComplete(win, _goals);
  }

  function _zoneCenterX(dir) {
    var goalX = 44, goalW = VW - 88;
    if (dir === 'left')  return goalX + goalW / 6;
    if (dir === 'right') return goalX + goalW * 5 / 6;
    return goalX + goalW / 2; // center
  }

  return {
    update: function (dt, input) {
      var pressed = (input && input.pressed) || {};
      if (_phase === 'aim') {
        if (pressed.left) { _kick('left'); return; }
        if (pressed.right) { _kick('right'); return; }
        if (pressed.up || pressed.confirm) { _kick('center'); return; }
        return;
      }
      if (_phase === 'result') {
        _timer += dt;
        var anyKey = pressed.confirm || pressed.cancel ||
                     pressed.left || pressed.right || pressed.up || pressed.down;
        if (_timer >= 1.1 || (_timer >= 0.5 && anyKey)) {
          if (_shot >= MAX_SHOTS) { _phase = 'done'; _timer = 0; }
          else { _phase = 'aim'; }
        }
        return;
      }
      if (_phase === 'done') {
        _timer += dt;
        if (_timer >= 0.4 && (pressed.confirm || pressed.cancel)) {
          _finish();
        }
        return;
      }
    },

    draw: function (ctx) {
      // 1. よるのスタジアム背景
      var bg = ctx.createLinearGradient(0, 0, 0, VH);
      bg.addColorStop(0,   '#0b1733');
      bg.addColorStop(0.5, '#13245a');
      bg.addColorStop(1,   '#0a3d1f'); // 芝のみどり
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, VW, VH);

      // 2. タイトル
      S.drawWindow(ctx, VW / 2 - 70, 14, 140, 28, { radius: 8, border: '#ffd34d' });
      S.drawText(ctx, 'PK せん！', VW / 2, 21, { size: 16, color: '#ffe9a8', align: 'center' });

      // 3. ゴール枠＋3ゾーン
      var goalX = 44, goalW = VW - 88, goalY = 120, goalH = 120;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(goalX, goalY, goalW, goalH);
      // ネット風の薄い縦線
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      for (var gi = 1; gi < 6; gi++) {
        var lx = goalX + (goalW / 6) * gi;
        ctx.beginPath(); ctx.moveTo(lx, goalY); ctx.lineTo(lx, goalY + goalH); ctx.stroke();
      }
      // ゾーン区切り
      ctx.strokeStyle = 'rgba(255,211,77,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(goalX + goalW / 3, goalY); ctx.lineTo(goalX + goalW / 3, goalY + goalH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(goalX + goalW * 2 / 3, goalY); ctx.lineTo(goalX + goalW * 2 / 3, goalY + goalH); ctx.stroke();

      // 4. キーパー＆ボール（結果表示中だけ）
      if (_phase === 'result' || _phase === 'done') {
        if (_keeperDir) {
          var kx = _zoneCenterX(_keeperDir);
          var ky = goalY + goalH / 2;
          ctx.fillStyle = '#ff5a5a';
          ctx.fillRect(kx - 12, ky - 14, 24, 36);      // 体
          ctx.fillStyle = '#ffd0b0';
          ctx.beginPath(); ctx.arc(kx, ky - 22, 9, 0, Math.PI * 2); ctx.fill(); // 頭
          // 手をひろげる
          ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(kx - 12, ky - 8); ctx.lineTo(kx - 26, ky - 20); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(kx + 12, ky - 8); ctx.lineTo(kx + 26, ky - 20); ctx.stroke();
        }
        if (_shootDir) {
          var bx = _zoneCenterX(_shootDir);
          var by = _goal ? (goalY + goalH * 0.32) : (goalY + goalH + 26); // ゴールは枠内、セーブは枠下にはじく
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(bx, by, 10, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(bx, by, 10, 0, Math.PI * 2); ctx.stroke();
        }
      }

      // 5. スコア
      S.drawWindow(ctx, VW / 2 - 90, goalY + goalH + 50, 180, 30, { radius: 6, border: '#5ec8ff' });
      S.drawText(ctx, 'PK ' + _shot + ' / ' + MAX_SHOTS + '   ゴール ' + _goals,
                 VW / 2, goalY + goalH + 58, { size: 13, color: '#dff4ff', align: 'center' });

      // 6. メッセージ窓（下部）
      var msgY = VH - 96;
      S.drawWindow(ctx, 12, msgY, VW - 24, 80, { radius: 8, border: '#ffd34d' });
      var line1, line2;
      if (_phase === 'aim') {
        line1 = 'ねらいを きめて シュート！';
        line2 = '←ひだり  ↑/けってい=まんなか  →みぎ';
      } else if (_phase === 'result') {
        line1 = _goal ? 'ゴール！！' : 'セーブ された…';
        line2 = _goal ? 'ナイスシュート！' : 'つぎは ばしょを かえてみよう';
      } else {
        var win = _goals >= WIN_GOALS;
        line1 = win ? ('かち！  ' + _goals + ' / ' + MAX_SHOTS + ' てん！') : ('まけ…  ' + _goals + ' / ' + MAX_SHOTS + ' てん');
        line2 = 'けってい/キャンセル で とじる';
      }
      S.drawText(ctx, line1, VW / 2, msgY + 22, { size: 15, color: _phase === 'result' && _goal ? '#ffe9a8' : '#dff4ff', align: 'center' });
      S.drawText(ctx, line2, VW / 2, msgY + 50, { size: 11, color: '#bcd6f0', align: 'center' });
    },

    isDone: function () { return _done; },

    // テスト/検証用：内部状態を観測する。
    _debug: function () {
      return { phase: _phase, shot: _shot, goals: _goals, win: _goals >= WIN_GOALS, maxShots: MAX_SHOTS, winGoals: WIN_GOALS };
    },
  };
}

// ── UMD エクスポート ──────────────────────────────────────────────────
(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  createFieldScene: createFieldScene,
  createPkScene:    createPkScene,
  frontTile:        frontTile,
  isWalkable:       isWalkable,
  clampCamera:      clampCamera,
  pendingCutscene:  pendingCutscene,
  warpAt:           warpAt,
  conveyorAt:       conveyorAt,
  puzzleSolved:     puzzleSolved,
  tryPushBlock:     tryPushBlock,
  _withActiveNpcs:  _withActiveNpcs,
});
