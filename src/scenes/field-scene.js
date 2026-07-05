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
 * walkSideFlip: フィールド歩行スプライト(side)を左右反転して描くべきか。
 *   side素材の実際の向きは、ユイトだけ「左向き」・他4人(ikuma/aoshi/tomoki/itsuki)は「右向き」。
 *   （実画像検証で確定。以前は「右向きはイクマだけ」と誤メタデータで aoshi/tomoki/itsuki が逆を向いていた）
 *   素材の向きと逆へ歩くときだけ反転する：右向き素材は左移動で反転、左向き素材(ユイト)は右移動で反転。
 * @param {string} id キャラID（yuito/ikuma/aoshi/tomoki/itsuki）
 * @param {string} facing 'up' | 'down' | 'left' | 'right'
 * @returns {boolean} 左右反転して描くなら true
 */
function walkSideFlip(id, facing) {
  var sideFacesRight = (id !== 'yuito');   // side素材が右向きなのはユイト以外の4人
  return sideFacesRight ? (facing === 'left') : (facing === 'right');
}

// npcMarkerKind: マップ上のNPCの頭上に出すマークの種類を決める。
//   話しかけ処理 _talkTo と同じ優先順位（shop→forge→joinId→boss→bossRush→quest→会話）で判定する。
//   純粋関数（副作用なし）＝ node --test で回帰できる。S.questStage 等に依存せず、
//   済み判定は state.flags / state.party を直接見る。
//   戻り値: 'inn' | 'shop' | 'forge' | 'ally' | 'boss' | 'quest' | 'talk' | 'none'
function npcMarkerKind(npc, state) {
  if (!npc) return 'none';
  var flags = (state && state.flags) || {};
  var party = (state && state.party) || [];
  // 役割が「済み状態」のとき落ちる先＝会話できるなら talk、会話も無ければ none。
  var talk = ((npc.pages && npc.pages.length) || (npc.afterPages && npc.afterPages.length)) ? 'talk' : 'none';

  if (npc.shop) return (npc.shop.type === 'inn') ? 'inn' : 'shop';
  if (npc.forge) return 'forge';
  if (npc.joinId) {
    var joined = party.some(function (p) { return p.id === npc.joinId; });
    return joined ? 'talk' : 'ally';   // 加入済みは _talkTo で会話するので talk
  }
  if (npc.boss) {
    var bwin = npc.boss.winFlag;
    return (bwin && flags[bwin]) ? 'talk' : 'boss';
  }
  if (npc.bossRush) {
    var rwin = npc.bossRush.winFlag;
    return (rwin && flags[rwin]) ? 'talk' : 'boss';
  }
  if (npc.quest) {
    var dflag = npc.quest.doneFlag;
    return (dflag && flags[dflag]) ? 'talk' : 'quest';
  }
  return talk;
}

// _drawNpcMarker: npcMarkerKind の結果を NPC の頭上に小さなバッジで描く。
//   sx,sy は NPC スプライトの左上スクリーン座標。phase(_gfx) で ふわふわ上下する。
//   文字記号($ ! ?)は nested の glyph() で描き、ベッド/金づち/✦ は手描き。
function _drawNpcMarker(ctx, kind, sx, sy, TS, phase) {
  if (!kind || kind === 'none') return;
  var COL = {
    inn: '#2bb673', shop: '#2bb673', forge: '#f0a020',
    ally: '#ffd200', boss: '#e8443a', quest: '#a065d0', talk: '#ffd200'
  };
  var col = COL[kind] || '#ffd200';
  var small = (kind === 'talk');          // 通常会話は控えめ
  var rad = small ? 6 : 8;                 // バッジ半径
  var bob = Math.sin(phase * 3) * 1.6;     // ふわふわ上下
  var cx = sx + TS / 2;
  var cy = sy - rad - 2 + bob;             // 頭上

  function glyph(ch) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + Math.round(rad * 1.9) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, cx, cy + 0.5);
  }

  ctx.save();
  // 影（少し大きい黒丸）→ 本体（役割色）→ 白フチ
  ctx.beginPath(); ctx.arc(cx, cy, rad + 1.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fillStyle = col; ctx.fill();
  ctx.lineWidth = 1.4; ctx.strokeStyle = '#ffffff'; ctx.stroke();

  ctx.fillStyle = '#ffffff';
  if (kind === 'shop') glyph('$');
  else if (kind === 'boss' || kind === 'talk') glyph('!');
  else if (kind === 'quest') glyph('?');
  else if (kind === 'inn') {
    // ベッド：マット＋枕
    var bw = rad * 1.35, bh = rad * 0.5;
    ctx.fillRect(cx - bw / 2, cy - bh / 2 + 1, bw, bh);
    ctx.fillRect(cx - bw / 2, cy - bh / 2 - 1.5, bw * 0.34, bh);
  } else if (kind === 'forge') {
    // 金づち：柄＋頭（少し傾ける）
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-0.5);
    ctx.fillRect(-0.9, -rad * 0.55, 1.8, rad * 1.15);
    ctx.fillRect(-rad * 0.55, -rad * 0.68, rad * 1.1, rad * 0.42);
    ctx.restore();
  } else if (kind === 'ally') {
    // ✦（4方向にとがった星）
    var r2 = rad * 0.78;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r2); ctx.lineTo(cx + r2 * 0.32, cy - r2 * 0.32);
    ctx.lineTo(cx + r2, cy); ctx.lineTo(cx + r2 * 0.32, cy + r2 * 0.32);
    ctx.lineTo(cx, cy + r2); ctx.lineTo(cx - r2 * 0.32, cy + r2 * 0.32);
    ctx.lineTo(cx - r2, cy); ctx.lineTo(cx - r2 * 0.32, cy - r2 * 0.32);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
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
  var list = (map && map.cutscenes) || (map && map.cutscene ? [map.cutscene] : []);
  for (var i = 0; i < list.length; i++) {
    var cs = list[i];
    if (!cs || !cs.pages || !cs.pages.length) continue;
    if (cs.requireFlag && !flags[cs.requireFlag]) continue;
    if (cs.flag && flags[cs.flag]) continue;
    return cs;
  }
  return null;
}

/**
 * npcPagesFor: NPC の会話ページを進行フラグで選ぶ純関数（物語編C-3）。
 *   variants の中から requireFlag を満たす「最後の（最も進んだ）」ものの pages を返す。
 *   該当なし・variants 無しなら従来の npc.pages。
 * @param {Object} npc   NPC 定義（pages / variants を持ちうる）
 * @param {Object} flags state.flags
 * @returns {Array} 表示するページ配列
 */
function npcPagesFor(npc, flags) {
  flags = flags || {};
  var pages = (npc && npc.pages) || [];
  var vs = (npc && npc.variants) || [];
  var chosen = null;
  for (var i = 0; i < vs.length; i++) {
    var v = vs[i];
    if (v && v.requireFlag && flags[v.requireFlag]) chosen = v; // 最後に一致したものを採用
  }
  return (chosen && chosen.pages) ? chosen.pages : pages;
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
function _drawFieldObject(ctx, S, type, sx, sy, TS, objArt, phase) {
  phase = phase || 0;
  // 風のゆれ（Phase2）：草木/花/看板は横にそよぎ、ボールはわずかに上下する。
  var swayT = (type === 'tree' || type === 'bush' || type === 'flower' || type === 'sign' || type === 'crop');
  var dx = swayT ? Math.sin(phase + (sx + sy) * 0.03) * (type === 'tree' ? 1.8 : 1.1) : 0;
  var dy = (type === 'ball') ? Math.sin(phase * 2 + sx * 0.05) * 1.1 : 0;
  ctx.save();
  if (dx || dy) ctx.translate(dx, dy);

  // ① AI差し替え（在れば優先）
  var drewAI = false;
  if (objArt && objArt[type] && S && typeof S.drawImageSprite === 'function') {
    var aBoxH = (type === 'tree' || type === 'goal') ? TS * 1.6 : TS * 1.1;
    drewAI = S.drawImageSprite(ctx, 'obj_' + type, objArt[type], sx + TS / 2, sy + TS - aBoxH / 2, aBoxH, false);
  }
  if (drewAI) { ctx.restore(); return; }

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
      // ネットのきらめき（Phase2）：白いハイライトが左右にゆっくり流れる。
      var gsh = (Math.sin(phase * 1.6) * 0.5 + 0.5);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.16 + 0.24 * gsh).toFixed(3) + ')';
      ctx.lineWidth = 1.5;
      var ghx = gx + 3 + gsh * (gw - 6);
      ctx.beginPath(); ctx.moveTo(ghx, gy + 2); ctx.lineTo(ghx, gy + gh); ctx.stroke();
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
    case 'well': {
      // 井戸（村の中央）：石の円筒＋三角屋根＋ゆれるつるべ。背が高いソリッド飾り。
      ctx.save();
      ctx.fillStyle = '#9aa3ad'; ctx.fillRect(cx - 9, by - 12, 18, 12);           // 石の筒
      ctx.fillStyle = '#7d868f'; ctx.fillRect(cx - 9, by - 12, 18, 3);            // 上縁の陰
      ctx.strokeStyle = '#6b747d'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(cx - 9, by - 7); ctx.lineTo(cx + 9, by - 7);
      ctx.moveTo(cx - 3, by - 12); ctx.lineTo(cx - 3, by - 7);
      ctx.moveTo(cx + 3, by - 7); ctx.lineTo(cx + 3, by); ctx.stroke();           // 石の目地
      ctx.fillStyle = '#22323f'; ctx.beginPath(); ctx.ellipse(cx, by - 12, 8, 3, 0, 0, Math.PI * 2); ctx.fill(); // 井戸の口
      ctx.fillStyle = '#3b6b8a'; ctx.beginPath(); ctx.ellipse(cx, by - 12, 5, 1.8, 0, 0, Math.PI * 2); ctx.fill(); // 水面
      ctx.fillStyle = '#6e4422'; ctx.fillRect(cx - 9, by - 28, 2.5, 16); ctx.fillRect(cx + 6.5, by - 28, 2.5, 16); // 支柱
      ctx.fillStyle = '#9c5b2c'; ctx.beginPath();
      ctx.moveTo(cx - 12, by - 26); ctx.lineTo(cx, by - 34); ctx.lineTo(cx + 12, by - 26); ctx.closePath(); ctx.fill(); // 三角屋根
      ctx.fillStyle = '#7d4622'; ctx.fillRect(cx - 12, by - 26, 24, 2);           // 屋根のふち
      var wob = Math.sin(phase * 1.3) * 1.5;                                      // つるべのゆれ
      ctx.strokeStyle = '#cfd6dd'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(cx, by - 26); ctx.lineTo(cx + wob, by - 18); ctx.stroke();       // なわ
      ctx.fillStyle = '#8a5a2e'; ctx.fillRect(cx + wob - 3, by - 18, 6, 5);       // バケツ
      ctx.fillStyle = '#6e4422'; ctx.fillRect(cx + wob - 3, by - 18, 6, 1.5);
      ctx.restore();
      break;
    }
    case 'fence': {
      // 木の柵：杭2本＋横木2本。畑や家のまわりを囲うソリッド飾り。
      ctx.save();
      ctx.fillStyle = '#9c6b3a'; ctx.fillRect(cx - 9, by - 14, 3, 14); ctx.fillRect(cx + 6, by - 14, 3, 14); // 杭
      ctx.fillStyle = '#7d5126'; ctx.fillRect(cx - 9, by - 14, 3, 2); ctx.fillRect(cx + 6, by - 14, 3, 2);   // 杭の頭
      ctx.fillStyle = '#b07c45'; ctx.fillRect(cx - 10, by - 12, 20, 3); ctx.fillRect(cx - 10, by - 6, 20, 3); // 横木
      ctx.fillStyle = '#7d5126'; ctx.fillRect(cx - 10, by - 10, 20, 1); ctx.fillRect(cx - 10, by - 4, 20, 1); // 横木の陰
      ctx.restore();
      break;
    }
    case 'crop': {
      // 畑の作物：土のうね＋そよぐ葉＋小さな実。踏める地面デカール。
      ctx.save();
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(cx - 9, by - 5, 18, 5);             // 土のうね
      ctx.fillStyle = '#5a3c22'; ctx.fillRect(cx - 9, by - 5, 18, 1.5);
      function leaf(lx, h, col) {
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(lx, by - 4); ctx.quadraticCurveTo(lx - 3, by - 4 - h * 0.6, lx - 2, by - 4 - h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx, by - 4); ctx.quadraticCurveTo(lx + 3, by - 4 - h * 0.6, lx + 2, by - 4 - h); ctx.stroke();
      }
      leaf(cx - 5, 8, '#4caf50'); leaf(cx, 10, '#5cc85a'); leaf(cx + 5, 8, '#4caf50');
      blob(cx, by - 11, 2.2, '#ff6b5e'); blob(cx - 5, by - 9, 1.6, '#ffb347');    // 実
      ctx.restore();
      break;
    }
    case 'torch': {
      // 壁かけの たいまつ（暗闇ダンジョンの あかり）。phase でほのおが ゆらめく。
      ctx.save();
      var tflk = Math.sin(phase * 6 + sx * 0.7) * 0.5 + 0.5;   // 0..1 ゆらぎ
      ctx.fillStyle = '#6e4422'; ctx.fillRect(cx - 1.5, by - 16, 3, 12);          // 木の柄
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(cx - 3, by - 16, 6, 2);            // 受け金具
      var ty = by - 18 - tflk * 2;
      ctx.fillStyle = 'rgba(255,120,20,0.95)';                                   // 外炎
      ctx.beginPath();
      ctx.moveTo(cx, ty - 9 - tflk * 3);
      ctx.quadraticCurveTo(cx - 5, ty - 2, cx - 3, ty + 3);
      ctx.quadraticCurveTo(cx, ty + 5, cx + 3, ty + 3);
      ctx.quadraticCurveTo(cx + 5, ty - 2, cx, ty - 9 - tflk * 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,210,60,0.95)';                                   // 内炎
      ctx.beginPath();
      ctx.moveTo(cx, ty - 6 - tflk * 2);
      ctx.quadraticCurveTo(cx - 2.5, ty - 1, cx - 1.5, ty + 2);
      ctx.quadraticCurveTo(cx, ty + 3, cx + 1.5, ty + 2);
      ctx.quadraticCurveTo(cx + 2.5, ty - 1, cx, ty - 6 - tflk * 2);
      ctx.fill();
      blob(cx, ty - 1, 1.4, '#fff3b0');                                          // 芯のきらめき
      ctx.restore();
      break;
    }
    default: break;
  }
  ctx.restore();
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

// ── 動き・演出レイヤー（マップに彩り＆生命感を足す。すべて描画専用＝ロジック不変）──
//   位相 phase（_gfx）だけで決まる決定論的アニメ。毎フレーム Math.random を呼ばない
//   ので チラつかない。タイルや当たり判定には一切触れず「上に重ねる」だけ。

// 整数 n から決まる擬似乱数 [0,1)。粒子の初期位置/速度の種に使う（毎フレーム同じ値）。
function _hash01(n) {
  var x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// マップの「ふんいき」テーマを決める。map.ambient があれば最優先、
// 無ければ dark マップは 'embers'、それ以外は 'petals'（花びら）を既定にする。
function _ambientFor(map) {
  if (map && map.ambient) return map.ambient;
  if (map && map.dark) return 'embers';
  return 'petals';
}

// やわらかい雲のかたまり（円を3つ重ねる）。
function _puff(ctx, x, y, rx, ry, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x, y, ry, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x - rx * 0.6, y + ry * 0.25, ry * 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + rx * 0.6, y + ry * 0.2, ry * 0.85, 0, Math.PI * 2); ctx.fill();
}

// 背景レイヤー（地面の上・キャラの下）：流れ雲・雲かげ・星。奥行きを薄く足す。
function _drawSkyLayer(ctx, theme, VW, VH, phase) {
  ctx.save();
  var i;
  if (theme === 'night') {
    // 星：位置は hash で固定し、明るさだけ sin でまたたかせる。
    for (i = 0; i < 34; i++) {
      var stx = _hash01(i) * VW;
      var sty = _hash01(i * 2.1) * VH * 0.7;
      var tw = 0.35 + 0.65 * Math.abs(Math.sin(phase * 1.6 + i));
      ctx.fillStyle = 'rgba(255,255,255,' + (tw * 0.9).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(stx, sty, i % 7 === 0 ? 1.8 : 1.1, 0, Math.PI * 2); ctx.fill();
    }
  } else if (theme === 'sky') {
    for (i = 0; i < 5; i++) {
      var w = VW + 220;
      var cx = (_hash01(i) * w + phase * 7) % w - 110;
      var cy = 18 + _hash01(i * 3.3) * VH * 0.4;
      _puff(ctx, cx, cy, 26, 13, 'rgba(255,255,255,0.20)');
    }
  } else if (theme === 'snow' || theme === 'rain') {
    var col = theme === 'rain' ? 'rgba(40,52,74,0.16)' : 'rgba(205,214,230,0.12)';
    var spd = theme === 'rain' ? 14 : 6;
    for (i = 0; i < 4; i++) {
      var w2 = VW + 240;
      var dx = (_hash01(i * 1.7) * w2 + phase * spd) % w2 - 120;
      var dy = 16 + _hash01(i * 4.1) * VH * 0.35;
      _puff(ctx, dx, dy, 34, 16, col);
    }
  } else if (theme === 'petals' || theme === 'leaves' || theme === 'sand' || theme === 'forest') {
    // 雲かげ：うっすら暗い楕円がゆっくり流れる＝晴れた屋外の奥行き。
    for (i = 0; i < 3; i++) {
      var w3 = VW + 260;
      var ex = (_hash01(i * 2.7) * w3 + phase * 4) % w3 - 130;
      var ey = 30 + _hash01(i * 5.5) * VH * 0.5;
      _puff(ctx, ex, ey, 40, 18, 'rgba(0,0,0,0.05)');
    }
  }
  ctx.restore();
}

// 前景レイヤー（キャラの上）：花びら・落ち葉・雨・雪・砂ぼこり・きらめき・ほたる・火の粉。
function _drawWeatherLayer(ctx, theme, VW, VH, phase) {
  ctx.save();
  var i, px, py, a, base;
  if (theme === 'rain') {
    ctx.strokeStyle = 'rgba(180,214,255,0.55)'; ctx.lineWidth = 1.5;
    for (i = 0; i < 30; i++) {
      px = (_hash01(i) * VW + phase * 12) % (VW + 30) - 15;
      py = (_hash01(i * 1.7) * VH + phase * 160) % (VH + 24) - 12;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 4, py + 13); ctx.stroke();
    }
  } else if (theme === 'snow') {
    for (i = 0; i < 24; i++) {
      base = _hash01(i) * VW;
      px = base + Math.sin(phase * 1.1 + i) * 14;
      py = (_hash01(i * 1.9) * VH + phase * 9) % (VH + 16) - 8;
      a = 0.7 + 0.3 * Math.sin(phase * 2 + i);
      ctx.fillStyle = 'rgba(255,255,255,' + (a < 0.4 ? 0.4 : a).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(px, py, i % 4 === 0 ? 2.6 : 1.7, 0, Math.PI * 2); ctx.fill();
    }
  } else if (theme === 'leaves') {
    var lcol = ['#e0913a', '#c75b39', '#d8b13a', '#b8772e'];
    for (i = 0; i < 16; i++) {
      base = _hash01(i) * VW;
      px = base + Math.sin(phase * 1.4 + i * 0.7) * 16;
      py = (_hash01(i * 1.6) * VH + phase * 24) % (VH + 18) - 9;
      ctx.save(); ctx.translate(px, py); ctx.rotate(phase * 0.8 + i);
      ctx.fillStyle = lcol[i % lcol.length];
      ctx.beginPath();
      if (ctx.ellipse) ctx.ellipse(0, 0, 4, 2.2, 0, 0, Math.PI * 2);
      else ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill(); ctx.restore();
    }
  } else if (theme === 'sand') {
    for (i = 0; i < 20; i++) {
      px = (_hash01(i) * (VW + 40) + phase * 34) % (VW + 40) - 20;
      py = _hash01(i * 2.3) * VH + Math.sin(phase * 1.5 + i) * 6;
      ctx.fillStyle = 'rgba(228,206,150,' + (0.25 + 0.25 * _hash01(i * 3)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(px, py, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  } else if (theme === 'sky') {
    for (i = 0; i < 16; i++) {
      px = (_hash01(i) * (VW + 30) + phase * 8) % (VW + 30) - 15;
      py = _hash01(i * 2.7) * VH;
      a = 0.3 + 0.7 * Math.abs(Math.sin(phase * 2.2 + i * 1.3));
      ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(px, py, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  } else if (theme === 'night') {
    // ほたる：黄緑のひかりがふわふわ漂う（グローつき）。
    for (i = 0; i < 16; i++) {
      base = _hash01(i) * VW;
      px = base + Math.sin(phase * 0.9 + i) * 24;
      py = _hash01(i * 1.4) * VH * 0.9 + Math.cos(phase * 0.7 + i * 1.3) * 14;
      a = 0.35 + 0.55 * Math.abs(Math.sin(phase * 2.4 + i));
      var g = ctx.createRadialGradient(px, py, 0, px, py, 6);
      g.addColorStop(0, 'rgba(206,255,140,' + a.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(206,255,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
    }
  } else if (theme === 'embers') {
    // 火の粉：オレンジの粒がゆらゆら昇る（くらいマップの探索感）。大きめは光をまとう。
    for (i = 0; i < 24; i++) {
      base = _hash01(i) * VW;
      px = base + Math.sin(phase * 1.3 + i) * 14;
      py = VH - ((_hash01(i * 1.8) * VH + phase * 18) % (VH + 24)) + 10;
      a = 0.4 + 0.6 * Math.abs(Math.sin(phase * 3 + i));
      var big = _hash01(i * 5) > 0.66;
      if (big) {
        var eg = ctx.createRadialGradient(px, py, 0, px, py, 5);
        eg.addColorStop(0, 'rgba(255,196,96,' + a.toFixed(3) + ')');
        eg.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,' + (big ? 190 : 168) + ',' + (big ? 110 : 72) + ',' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(px, py, big ? 2.4 : 1.4, 0, Math.PI * 2); ctx.fill();
    }
  } else if (theme === 'forest') {
    // こもれび：木の すきまから さしこむ 黄みどりの ひかりの つぶが ふわふわ ただよう（グローつき）。
    for (i = 0; i < 18; i++) {
      base = _hash01(i) * VW;
      px = base + Math.sin(phase * 0.8 + i) * 20;
      py = (_hash01(i * 1.5) * VH + phase * 7) % (VH + 18) - 9;
      a = 0.3 + 0.5 * Math.abs(Math.sin(phase * 1.8 + i * 1.2));
      var fg = ctx.createRadialGradient(px, py, 0, px, py, 5);
      fg.addColorStop(0, 'rgba(214,255,150,' + a.toFixed(3) + ')');
      fg.addColorStop(1, 'rgba(170,230,110,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(235,255,190,' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(px, py, 1.3, 0, Math.PI * 2); ctx.fill();
    }
  } else { // 'petals'（既定）：さくらの花びらがひらひら舞う。
    var pcol = ['rgba(255,200,228,', 'rgba(255,232,242,', 'rgba(255,182,214,'];
    for (i = 0; i < 16; i++) {
      base = _hash01(i) * VW;
      px = base + Math.sin(phase * 1.2 + i * 0.8) * 18;
      py = (_hash01(i * 1.5) * VH + phase * 14) % (VH + 16) - 8;
      a = 0.6 + 0.3 * Math.sin(phase + i);
      ctx.fillStyle = pcol[i % pcol.length] + (a < 0.35 ? 0.35 : a).toFixed(3) + ')';
      ctx.save(); ctx.translate(px, py); ctx.rotate(phase * 0.6 + i);
      ctx.beginPath();
      if (ctx.ellipse) ctx.ellipse(0, 0, 3.4, 2, 0, 0, Math.PI * 2);
      else ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
      ctx.fill(); ctx.restore();
    }
  }
  ctx.restore();
}

// 水面のきらめき：水タイルの上を、ひかりの帯が上下にゆれる（マスごとに位相をずらす）。
function _drawWaterShimmer(ctx, sx, sy, TS, phase) {
  ctx.save();
  var a = 0.18 + 0.16 * Math.sin(phase * 1.4);
  ctx.strokeStyle = 'rgba(220,245,255,' + (a < 0.05 ? 0.05 : a).toFixed(3) + ')';
  ctx.lineWidth = 1.4;
  var yo = (Math.sin(phase) * 0.5 + 0.5) * (TS - 10) + 4;
  ctx.beginPath();
  ctx.moveTo(sx + 4, sy + yo);
  ctx.lineTo(sx + TS * 0.45, sy + yo - 2);
  ctx.lineTo(sx + TS - 4, sy + yo + 1);
  ctx.stroke();
  if (Math.sin(phase * 2.3) > 0.6) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(sx + TS * 0.7, sy + yo - 4, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// 宝箱の上で ✦ がチカチカ：未開封の宝をプレイヤーに気づかせる点滅。
// _drawChestAura: 未開封の宝箱の足元に、やわらかい光の輪（放射グラデ）を敷く。
//   地面が金色に光って「ここに宝があるよ」を遠くからでも強調する。
function _drawChestAura(ctx, sx, sy, TS, phase) {
  var cx = sx + TS / 2, cy = sy + TS - 5;
  var pulse = 0.6 + 0.4 * Math.abs(Math.sin(phase * 1.6));
  var R = TS * 0.55 * pulse;
  ctx.save();
  var g = ctx.createRadialGradient(cx, cy, 1, cx, cy, R);
  g.addColorStop(0, 'rgba(255,226,120,0.55)');
  g.addColorStop(0.5, 'rgba(255,210,90,0.22)');
  g.addColorStop(1, 'rgba(255,210,90,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, R, R * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// _drawOpenedChest: 開封済みの宝箱を「ふたが開いた空箱」で薄く（低alpha）残す。
//   どこの宝を取ったか一目でわかり、取りこぼし探索がラクになる。
function _drawOpenedChest(ctx, sx, sy, TS) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#7a4f28'; ctx.fillRect(sx + 5, sy + 14, TS - 10, TS - 16);
  ctx.fillStyle = '#3a250f'; ctx.fillRect(sx + 7, sy + 15, TS - 14, 4);
  ctx.fillStyle = '#96602f';
  ctx.beginPath();
  ctx.moveTo(sx + 5, sy + 14);
  ctx.lineTo(sx + 7, sy + 6);
  ctx.lineTo(sx + TS - 7, sy + 6);
  ctx.lineTo(sx + TS - 5, sy + 14);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(58,35,15,0.8)'; ctx.lineWidth = 1;
  ctx.strokeRect(sx + 5, sy + 14, TS - 10, TS - 16);
  ctx.restore();
}

function _drawChestGlow(ctx, sx, sy, TS, phase) {
  var cx = sx + TS / 2, cy = sy + 2;
  var tw = Math.abs(Math.sin(phase * 2.2));
  if (tw < 0.2) return; // ときどき消える＝点滅
  ctx.save();
  var r = 3 + tw * 3.2;
  ctx.fillStyle = 'rgba(255,240,170,' + (0.5 + 0.5 * tw).toFixed(3) + ')';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.4, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.4, cy);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - r, cy); ctx.lineTo(cx, cy - r * 0.4); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r * 0.4);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// つぎの もくひょう バー（進行ナビ）：画面上部のネームプレート下に常設表示。
// text が空なら何も描かない。color は あたたかい金色で「いま向かう場所」を強調。
function _drawObjectiveBar(ctx, S, text) {
  if (!text) return;
  var VW = S.VW;
  var w = 188, h = 20;
  var x = VW / 2 - w / 2, y = 34;
  S.drawWindow(ctx, x, y, w, h, { radius: 7, border: '#ffcf4a' });
  S.drawText(ctx, '▶ ' + text, VW / 2, y + 4, { size: 11, color: '#ffe9a0', align: 'center' });
}

// ── 弾7-①：スムーズスクロール用の純粋関数（描画補間のみ・ゲームロジックは整数マスのまま） ──
// lerp: 線形補間。a→b を t(0..1) で。
function lerp(a, b, t) {
  return a + (b - a) * t;
}
// stepEase: 歩行1マスぶんの easeOut。足元が気持ちよくなる程度の軽い減速。境界はクランプ。
function stepEase(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * (2 - t);
}

// ── 弾7-②：ミニマップ用の地形分類（純粋関数） ──
// 生タイルを 'floor'（歩ける）/'wall'（通れない）に粗く丸める。
// secret:true（隠し通路 H など）は wall 扱い＝ミニマップに隠し要素を露出しない。
function minimapCell(grid, x, y, legend) {
  if (!grid || y < 0 || y >= grid.length) return 'wall';
  var row = grid[y];
  if (!row || x < 0 || x >= row.length) return 'wall';
  var ch = row.charAt(x);
  var def = legend && legend[ch];
  if (!def) return 'wall';
  if (def.secret === true) return 'wall';
  if (def.walkable === true) return 'floor';
  return 'wall';
}

// ── 弾7-③：行き先看板用の最寄り出口判定（純粋関数） ──
// px,py から radius マス以内で最も近い出口の案内文を返す。範囲外は null。
// 行き先名は mapsById[to].name から引く（無ければ to をそのまま）。
function nearestExitLabel(map, px, py, radius, mapsById) {
  if (!map || !map.exits || !map.exits.length) return null;
  var best = null, bestD = Infinity;
  for (var i = 0; i < map.exits.length; i++) {
    var ex = map.exits[i];
    if (ex == null || ex.x == null || ex.y == null) continue;
    var d = Math.abs(ex.x - px) + Math.abs(ex.y - py); // マンハッタン距離
    if (d <= radius && d < bestD) { bestD = d; best = ex; }
  }
  if (!best) return null;
  var dest = mapsById && mapsById[best.to];
  var name = (dest && dest.name) || best.to;
  return '→ ' + name + 'へ';
}

// ── 弾7-③：行き先看板の描画（画面下部・出口接近時のみ） ──
// 仮想パッドの▼ボタン(x=55..105, y=457..507)と重ならないよう右下へ寄せる。
function _drawSignpost(ctx, S, text, VW, VH) {
  if (!text) return;
  var w = 176, h = 24;
  var x = VW - w - 6, y = VH - h - 10;
  S.drawWindow(ctx, x, y, w, h, { radius: 8, border: '#7cf29b' });
  S.drawText(ctx, text, x + w / 2, y + 6, { size: 12, color: '#c8f7d4', align: 'center' });
}

// ── 弾7-②：ミニマップ描画（画面右上・常時オーバーレイ） ──
// 地形=粗い点（floor薄/wall濃）、出口=黄マーカー、自分=点滅する赤点。
// 暗闇マップ(map.dark)は地形を伏せて自分と出口のみ（迷子防止優先）。
// phase: 点滅アニメ用位相（呼び出し側の _gfx を渡す）。y0: パネル上端Y。
function _drawMinimap(ctx, S, map, px, py, VW, phase, y0) {
  if (!map || !map.grid || !map.grid.length) return;
  var legend = S.TILE_LEGEND || {};
  var cols = map.grid[0].length, rows = map.grid.length;
  var MAXW = 66, MAXH = 66, PAD = 4;
  var cell = Math.max(1, Math.floor(Math.min(MAXW / cols, MAXH / rows)));
  var innerW = cols * cell, innerH = rows * cell;
  var panelW = innerW + PAD * 2, panelH = innerH + PAD * 2;
  var x0 = VW - panelW - 6;
  var top = y0;
  // パネル枠
  S.drawWindow(ctx, x0, top, panelW, panelH, { radius: 6, border: '#8fd0ff' });
  var gx = x0 + PAD, gy = top + PAD;
  var dark = !!map.dark;
  // 地形
  for (var y = 0; y < rows; y++) {
    for (var x = 0; x < cols; x++) {
      var kind = minimapCell(map.grid, x, y, legend);
      if (dark) {
        ctx.fillStyle = 'rgba(20,24,38,0.75)';
      } else if (kind === 'floor') {
        ctx.fillStyle = 'rgba(150,180,120,0.55)';
      } else {
        ctx.fillStyle = 'rgba(40,50,70,0.70)';
      }
      ctx.fillRect(gx + x * cell, gy + y * cell, cell, cell);
    }
  }
  // 出口（黄マーカー）
  if (map.exits && map.exits.length) {
    ctx.fillStyle = '#ffd34d';
    for (var e = 0; e < map.exits.length; e++) {
      var ex = map.exits[e];
      if (ex == null || ex.x == null || ex.y == null) continue;
      ctx.fillRect(gx + ex.x * cell, gy + ex.y * cell, Math.max(2, cell), Math.max(2, cell));
    }
  }
  // 自分（点滅する赤点）
  var blink = 0.5 + 0.5 * Math.sin((phase || 0) * 3);
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.45 * blink;
  ctx.fillStyle = '#ff5d5d';
  var selfSize = Math.max(3, cell + 1);
  ctx.fillRect(gx + px * cell - (selfSize - cell) / 2, gy + py * cell - (selfSize - cell) / 2, selfSize, selfSize);
  ctx.restore();
}

// ── 弾6：DQ風の地形タイル（コードで手描き＝procedural）＋ふちどり（autotile） ──
//   新タイル（森/川/橋/岩/花畑）は AI テクスチャを持たないので canvas に直接描く。
//   下地（草 or 水）はタイルループ側で先に敷き、ここでは上に「もの」を重ねる。

// procedural で描くタイルか。true なら下地の上に _drawProcTile で装飾を重ねる。
var _PROC_TILES_T = { t_tree: 1, t_river: 1, t_bridge: 1, t_rock: 1, t_flower: 1 };
function _isProcTile(sprite) { return !!_PROC_TILES_T[sprite]; }

// proc タイルの下地スプライト名（川/橋は水の上、森/岩/花は草の上に乗る）。
function _procBaseSprite(sprite) {
  return (sprite === 't_river' || sprite === 't_bridge') ? 't_water' : 't_grass';
}

// ふちどり（autotile）汎用：上下左右のとなりが pred を満たすマスかをビットで返す。
//   bit1=上, bit2=右, bit4=下, bit8=左。範囲外は「満たさない」扱い（純粋関数＝テスト対象）。
//   pred は文字（'.'や'~'）を受け取り true/false を返す判定関数。
function _neighborMask(grid, r, c, pred) {
  function hit(rr, cc) {
    if (rr < 0 || cc < 0 || rr >= grid.length || cc >= grid[rr].length) return false;
    return !!pred(grid[rr].charAt(cc));
  }
  var m = 0;
  if (hit(r - 1, c)) m |= 1;
  if (hit(r, c + 1)) m |= 2;
  if (hit(r + 1, c)) m |= 4;
  if (hit(r, c - 1)) m |= 8;
  return m;
}

// 「水」とみなす文字（水たまり/川/深い水）。ふちどりの下地判定に使う。
function _isWaterChar(ch) { return ch === '~' || ch === 'r' || ch === 'W'; }

// ふちどり（autotile）用：上下左右のとなりが水かをビットで返す（後方互換ラッパー）。
function _waterEdgeMask(grid, r, c) { return _neighborMask(grid, r, c, _isWaterChar); }

// 陸タイルが水/川にせっする辺へ「砂のなぎさ」をしく＝DQ感の本体（水ぎわのなじみ）。
function _drawShoreEdges(ctx, x, y, s, mask) {
  ctx.save();
  var w2 = Math.round(s * 0.34), w1 = Math.round(s * 0.20);
  ctx.fillStyle = 'rgba(232,214,150,0.34)'; // 外側のやわらかい砂
  if (mask & 1) ctx.fillRect(x, y, s, w2);
  if (mask & 2) ctx.fillRect(x + s - w2, y, w2, s);
  if (mask & 4) ctx.fillRect(x, y + s - w2, s, w2);
  if (mask & 8) ctx.fillRect(x, y, w2, s);
  ctx.fillStyle = 'rgba(228,206,138,0.72)'; // きわのこい砂（水ぎわほどはっきり）
  if (mask & 1) ctx.fillRect(x, y, s, w1);
  if (mask & 2) ctx.fillRect(x + s - w1, y, w1, s);
  if (mask & 4) ctx.fillRect(x, y + s - w1, s, w1);
  if (mask & 8) ctx.fillRect(x, y, w1, s);
  ctx.restore();
}

// ── Phase7-①「土台」：基本タイルも全部コードで手描き（AI絵タイルは卒業）─────────
//   下地（草/道/壁/水/床＋砂/雪/深い水/石だたみ/木/洞窟床/洞窟壁/溶岩）を canvas に直接描く。
//   マスごとに _hash01(r,c) で少しだけ模様をずらし、タイルの繰り返し感を消す（チラつき無し＝決定論）。

// この sprite を _drawBaseTile が描けるか（描けないものは AI絵/ドット絵にフォールバック）。
var _BASE_TILES_T = {
  t_grass: 1, t_road: 1, t_wall: 1, t_water: 1, t_floor: 1,
  t_sand: 1, t_snow: 1, t_deepwater: 1, t_cobble: 1, t_wood: 1,
  t_cavefloor: 1, t_cavewall: 1, t_lava: 1,
  t_ice: 1, t_icewall: 1,
  t_moss: 1, t_vine: 1,
  t_shallow: 1,
};
function _isBaseTile(sprite) { return !!_BASE_TILES_T[sprite]; }
// 水面のきらめき/ふちどりの対象になる下地か（浅い水・深い水）。
function _isWaterSprite(sprite) { return sprite === 't_water' || sprite === 't_deepwater'; }

// マスごとの安定乱数（0..1）。同じ r,c なら毎フレーム同じ＝チラつかない。
function _tileRnd(r, c, k) { return _hash01(r * 73.13 + c * 19.71 + k * 3.97 + 0.5); }

// 基本タイルを 1 マス描く。dispatcher。
function _drawBaseTile(ctx, sprite, x, y, s, ph, r, c) {
  switch (sprite) {
    case 't_grass':     _drawGrassTile(ctx, x, y, s, r, c); return;
    case 't_road':      _drawDirtTile(ctx, x, y, s, r, c); return;
    case 't_wall':      _drawBrickWallTile(ctx, x, y, s, r, c); return;
    case 't_water':     _drawWaterBase(ctx, x, y, s, false); return;
    case 't_deepwater': _drawWaterBase(ctx, x, y, s, true); return;
    case 't_floor':     _drawPlankTile(ctx, x, y, s, r, c, '#b58a46', '#a4793a'); return;
    case 't_wood':      _drawPlankTile(ctx, x, y, s, r, c, '#c39150', '#ad7c3e'); return;
    case 't_sand':      _drawSandTile(ctx, x, y, s, r, c); return;
    case 't_snow':      _drawSnowTile(ctx, x, y, s, r, c); return;
    case 't_cobble':    _drawCobbleTile(ctx, x, y, s, r, c); return;
    case 't_cavefloor': _drawCaveFloorTile(ctx, x, y, s, r, c); return;
    case 't_cavewall':  _drawCaveWallTile(ctx, x, y, s, r, c); return;
    case 't_lava':      _drawLavaTile(ctx, x, y, s, ph, r, c); return;
    case 't_ice':       _drawIceTile(ctx, x, y, s, r, c); return;
    case 't_icewall':   _drawIceWallTile(ctx, x, y, s, r, c); return;
    case 't_moss':      _drawMossTile(ctx, x, y, s, r, c); return;
    case 't_vine':      _drawVineWallTile(ctx, x, y, s, r, c); return;
    case 't_shallow':   _drawShallowTile(ctx, x, y, s, r, c); return;
  }
}

// 草原：二色のまだら＋小さな芝のかたまり。やわらかい緑。
function _drawGrassTile(ctx, x, y, s, r, c) {
  ctx.fillStyle = '#57a14d';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(45,128,62,0.45)'; // 濃い緑のまだら
  for (var i = 0; i < 3; i++) {
    var bx = x + _tileRnd(r, c, i) * s * 0.8;
    var by = y + _tileRnd(r, c, i + 5) * s * 0.8;
    ctx.fillRect(bx, by, s * 0.16, s * 0.10);
  }
  ctx.fillStyle = 'rgba(150,212,118,0.40)'; // 明るい緑のハイライト
  for (var j = 0; j < 2; j++) {
    var lx = x + _tileRnd(r, c, j + 9) * s * 0.85;
    var ly = y + _tileRnd(r, c, j + 12) * s * 0.85;
    ctx.fillRect(lx, ly, s * 0.12, s * 0.08);
  }
}

// 土の道：あたたかい茶のまだら＋小石のつぶ。
function _drawDirtTile(ctx, x, y, s, r, c) {
  ctx.fillStyle = '#caa367';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(150,112,62,0.45)'; // こい土
  for (var i = 0; i < 3; i++) {
    var bx = x + _tileRnd(r, c, i + 2) * s * 0.82;
    var by = y + _tileRnd(r, c, i + 6) * s * 0.82;
    ctx.fillRect(bx, by, s * 0.18, s * 0.12);
  }
  ctx.fillStyle = 'rgba(228,206,150,0.5)'; // 明るい砂つぶ
  for (var j = 0; j < 3; j++) {
    var px = x + _tileRnd(r, c, j + 10) * s * 0.9;
    var py = y + _tileRnd(r, c, j + 14) * s * 0.9;
    ctx.fillRect(px, py, s * 0.07, s * 0.07);
  }
}

// 石レンガの壁：上に明るいフチ・下に影＋目地（モルタル）。城壁/小屋の壁に使う。
function _drawBrickWallTile(ctx, x, y, s, r, c) {
  ctx.fillStyle = '#6f6a72';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#5a5560'; // 目地（横2段・縦は段ごとにずらす）
  ctx.fillRect(x, y + s * 0.5 - 1, s, 2);
  var off = ((r % 2) === 0) ? 0 : s * 0.5;
  ctx.fillRect(x + ((off) % s), y, 2, s * 0.5);
  ctx.fillRect(x + ((off + s * 0.5) % s), y + s * 0.5, 2, s * 0.5);
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; // 上フチのハイライト
  ctx.fillRect(x, y, s, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';       // 下フチの影
  ctx.fillRect(x, y + s - 2, s, 2);
}

// 水（浅い/深い）：たてグラデの青。きらめき/ふちどりは呼び出し側で上に重ねる。
function _drawWaterBase(ctx, x, y, s, deep) {
  var g = ctx.createLinearGradient(x, y, x, y + s);
  if (deep) { g.addColorStop(0, '#1d3f6c'); g.addColorStop(1, '#102a4a'); }
  else      { g.addColorStop(0, '#3b80c4'); g.addColorStop(1, '#27598f'); }
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
}

// 板の床（室内・木のデッキ）：よこ板＋うすい目地。col1/col2 でトーンを変える。
function _drawPlankTile(ctx, x, y, s, r, c, col1, col2) {
  var planks = 4, pw = s / planks;
  for (var i = 0; i < planks; i++) {
    ctx.fillStyle = ((i + r) % 2 === 0) ? col1 : col2;
    ctx.fillRect(x, y + i * pw, s, pw);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; // 板の継ぎ目
    ctx.fillRect(x, y + i * pw, s, 1);
  }
}

// 砂地・砂浜：明るい砂＋つぶ。
function _drawSandTile(ctx, x, y, s, r, c) {
  ctx.fillStyle = '#e6cd8e';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(208,180,118,0.5)';
  for (var i = 0; i < 3; i++) {
    var bx = x + _tileRnd(r, c, i + 1) * s * 0.85;
    var by = y + _tileRnd(r, c, i + 4) * s * 0.85;
    ctx.fillRect(bx, by, s * 0.14, s * 0.06);
  }
  ctx.fillStyle = 'rgba(255,244,210,0.5)';
  for (var j = 0; j < 2; j++) {
    ctx.fillRect(x + _tileRnd(r, c, j + 8) * s * 0.9, y + _tileRnd(r, c, j + 11) * s * 0.9, s * 0.06, s * 0.06);
  }
}

// 雪原：白に少し青みのある雪＋へこみの影。
function _drawSnowTile(ctx, x, y, s, r, c) {
  ctx.fillStyle = '#eef4ff';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(170,196,232,0.40)'; // へこみの青い影
  for (var i = 0; i < 2; i++) {
    var bx = x + _tileRnd(r, c, i + 3) * s * 0.7;
    var by = y + _tileRnd(r, c, i + 7) * s * 0.7;
    if (ctx.ellipse) { ctx.beginPath(); ctx.ellipse(bx + s * 0.15, by + s * 0.15, s * 0.18, s * 0.08, 0, 0, Math.PI * 2); ctx.fill(); }
    else ctx.fillRect(bx, by, s * 0.3, s * 0.12);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; // きらめき
  ctx.fillRect(x + _tileRnd(r, c, 13) * s * 0.9, y + _tileRnd(r, c, 15) * s * 0.9, 2, 2);
}

// 石だたみ（村の道）：丸い石をならべ、すき間にモルタル。
function _drawCobbleTile(ctx, x, y, s, r, c) {
  ctx.fillStyle = '#8c857c'; // 目地（下地）
  ctx.fillRect(x, y, s, s);
  var cols = ['#b6ab9b', '#a89c8b', '#c0b6a6', '#9e9384'];
  var h = s * 0.5;
  for (var gy = 0; gy < 2; gy++) {
    for (var gx = 0; gx < 2; gx++) {
      var cx = x + gx * h + h / 2 + (_tileRnd(r, c, gy * 2 + gx) - 0.5) * 2;
      var cy = y + gy * h + h / 2 + (_tileRnd(r, c, gy * 2 + gx + 5) - 0.5) * 2;
      ctx.fillStyle = cols[(gy * 2 + gx + r + c) % cols.length];
      if (ctx.ellipse) { ctx.beginPath(); ctx.ellipse(cx, cy, h * 0.42, h * 0.36, 0, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(cx - h * 0.4, cy - h * 0.34, h * 0.8, h * 0.68);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; // 上のつや
      if (ctx.ellipse) { ctx.beginPath(); ctx.ellipse(cx - 1, cy - 2, h * 0.22, h * 0.14, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }
}

// 洞窟の床：暗い岩肌＋ひび＋小石のハイライト。
function _drawCaveFloorTile(ctx, x, y, s, r, c) {
  ctx.fillStyle = '#4a443e';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(30,26,22,0.6)'; // 暗いまだら/ひび
  for (var i = 0; i < 3; i++) {
    var bx = x + _tileRnd(r, c, i + 2) * s * 0.8;
    var by = y + _tileRnd(r, c, i + 6) * s * 0.8;
    ctx.fillRect(bx, by, s * 0.2, s * 0.07);
  }
  ctx.fillStyle = 'rgba(120,112,100,0.5)'; // 小石のハイライト
  ctx.fillRect(x + _tileRnd(r, c, 12) * s * 0.85, y + _tileRnd(r, c, 14) * s * 0.85, s * 0.08, s * 0.08);
}

// 洞窟の岩壁：ごつごつした暗い岩。明暗の面で立体に。
function _drawCaveWallTile(ctx, x, y, s, r, c) {
  ctx.fillStyle = '#2f2b27';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#43403a'; // 明るい岩の面
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + s * (0.5 + _tileRnd(r, c, 1) * 0.2), y);
  ctx.lineTo(x + s * (0.3 + _tileRnd(r, c, 2) * 0.2), y + s);
  ctx.lineTo(x, y + s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; // 上の弱いつや
  ctx.fillRect(x, y, s, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';        // 下の影
  ctx.fillRect(x, y + s - 3, s, 3);
}

// 溶岩：暗い地に、脈うつ光のひび。ph でグロウが明滅・流れる（決定論ハッシュで位置固定）。
function _drawLavaTile(ctx, x, y, s, ph, r, c) {
  ctx.fillStyle = '#5a1606';
  ctx.fillRect(x, y, s, s);
  var pulse = 0.45 + 0.45 * Math.sin(ph + (r * 7 + c * 3));
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip();
  ctx.fillStyle = 'rgba(255,96,20,' + (0.5 + 0.4 * pulse).toFixed(3) + ')'; // 明るい溶岩のながれ
  for (var i = 0; i < 2; i++) {
    var ly = y + s * (0.3 + i * 0.4) + Math.sin(ph * 0.7 + i + r) * 2;
    ctx.fillRect(x, ly, s, s * 0.16);
  }
  ctx.fillStyle = 'rgba(255,224,90,' + (0.4 + 0.5 * pulse).toFixed(3) + ')'; // 中心の白熱したひび
  var gx = x + s * (0.2 + _tileRnd(r, c, 1) * 0.5);
  var gy = y + s * (0.25 + _tileRnd(r, c, 2) * 0.4);
  if (ctx.ellipse) { ctx.beginPath(); ctx.ellipse(gx, gy, s * 0.14, s * 0.06, 0, 0, Math.PI * 2); ctx.fill(); }
  else ctx.fillRect(gx - s * 0.12, gy - s * 0.05, s * 0.24, s * 0.1);
  ctx.restore();
}

// 氷のゆか（こおりの とう）：青みの白に つるつるの つや＋ひびのライン＋きらめき。
//   雪原より青く・つやのハイライトを大きめに入れて「つるっとした氷」に見せる。
function _drawIceTile(ctx, x, y, s, r, c) {
  var g = ctx.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, '#dfeefb'); g.addColorStop(1, '#bcd8f0');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip();
  ctx.strokeStyle = 'rgba(150,184,220,0.55)'; ctx.lineWidth = 1; // 氷のひび（ななめの線）
  for (var i = 0; i < 2; i++) {
    var hx = x + _tileRnd(r, c, i + 2) * s;
    var hy = y + _tileRnd(r, c, i + 6) * s * 0.6;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + s * 0.4, hy + s * 0.5); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; // 大きめのつや（ななめの帯）
  ctx.beginPath();
  ctx.moveTo(x + s * 0.10, y + s * 0.18);
  ctx.lineTo(x + s * 0.34, y + s * 0.18);
  ctx.lineTo(x + s * 0.16, y + s * 0.46);
  ctx.lineTo(x - s * 0.02, y + s * 0.46);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; // きらめき
  ctx.fillRect(x + _tileRnd(r, c, 13) * s * 0.85, y + _tileRnd(r, c, 15) * s * 0.85, 2, 2);
  ctx.restore();
}

// 浅瀬（みずの どうくつ：歩いて渡れる あさい みず）：あわい アクア＋さざ波＋きらめき。
//   深い水(_drawWaterBase deep)より明るい水色にして「ここは入れる」と分かるようにする。
function _drawShallowTile(ctx, x, y, s, r, c) {
  var g = ctx.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, '#5bc4d6'); g.addColorStop(1, '#3a92b4');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.40)'; ctx.lineWidth = 1.4; // さざ波（よこの波線）
  for (var i = 0; i < 2; i++) {
    var wy = y + (0.30 + i * 0.34) * s + _tileRnd(r, c, i + 3) * s * 0.12;
    var wx = x + _tileRnd(r, c, i + 7) * s * 0.4;
    ctx.beginPath();
    ctx.moveTo(x, wy);
    ctx.quadraticCurveTo(wx + s * 0.25, wy - s * 0.10, wx + s * 0.5, wy);
    ctx.quadraticCurveTo(wx + s * 0.75, wy + s * 0.10, x + s, wy);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; // きらめき（2点）
  ctx.fillRect(x + _tileRnd(r, c, 11) * s * 0.85, y + _tileRnd(r, c, 14) * s * 0.5, 2, 2);
  ctx.fillRect(x + _tileRnd(r, c, 17) * s * 0.85, y + s * 0.55 + _tileRnd(r, c, 19) * s * 0.35, 2, 2);
  ctx.restore();
}

// 氷のかべ（こおりの とう）：あつい氷のブロック。たて面のグラデ＋角のハイライトと影で立体に。
function _drawIceWallTile(ctx, x, y, s, r, c) {
  var g = ctx.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, '#8fbfe6'); g.addColorStop(1, '#5f93c4');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(255,255,255,0.30)'; // 明るい氷の面（左上の三角）
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + s * (0.5 + _tileRnd(r, c, 1) * 0.2), y);
  ctx.lineTo(x + s * (0.3 + _tileRnd(r, c, 2) * 0.2), y + s);
  ctx.lineTo(x, y + s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';  // 上フチのつや
  ctx.fillRect(x, y, s, 2);
  ctx.fillStyle = 'rgba(40,84,130,0.4)';    // 下フチの影
  ctx.fillRect(x, y + s - 3, s, 3);
}

// 苔のゆか（もりの しんでん）：しっとりした濃い緑のじゅうたん。
//   草原より濃く・やわらかいまだら＋小さなコケのつぶ＋ところどころ明るい こけ。
function _drawMossTile(ctx, x, y, s, r, c) {
  var g = ctx.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, '#3f7a39'); // 上はやや明るい緑
  g.addColorStop(1, '#2f5f2c'); // 下は濃い緑
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip();
  ctx.fillStyle = 'rgba(28,72,30,0.5)'; // 濃い苔のまだら
  for (var i = 0; i < 4; i++) {
    var bx = x + _tileRnd(r, c, i) * s * 0.85;
    var by = y + _tileRnd(r, c, i + 5) * s * 0.85;
    ctx.beginPath();
    ctx.arc(bx, by, s * (0.08 + _tileRnd(r, c, i + 9) * 0.06), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(140,200,120,0.45)'; // 明るい こけの ハイライト
  for (var j = 0; j < 3; j++) {
    var lx = x + _tileRnd(r, c, j + 11) * s * 0.85;
    var ly = y + _tileRnd(r, c, j + 14) * s * 0.85;
    ctx.fillRect(lx, ly, s * 0.10, s * 0.07);
  }
  ctx.restore();
}

// つるのかべ（もりの しんでん）：石のかべに みどりの つるが からみつく。通れない。
//   氷のかべと同じ立体の作り＋ つるの線を上から重ねて「みどりの壁」に見せる。
function _drawVineWallTile(ctx, x, y, s, r, c) {
  var g = ctx.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, '#5e6b4a'); g.addColorStop(1, '#3c462f'); // こけむした灰緑の石
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; // 左上の明るい面
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + s * (0.5 + _tileRnd(r, c, 1) * 0.2), y);
  ctx.lineTo(x + s * (0.3 + _tileRnd(r, c, 2) * 0.2), y + s);
  ctx.lineTo(x, y + s);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(60,130,55,0.85)'; ctx.lineWidth = 2; // からみつく つる（たての うねり）
  for (var i = 0; i < 2; i++) {
    var vx = x + (0.3 + i * 0.4) * s + _tileRnd(r, c, i + 3) * s * 0.12;
    ctx.beginPath();
    ctx.moveTo(vx, y);
    ctx.quadraticCurveTo(vx + s * 0.18, y + s * 0.5, vx, y + s);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(120,190,90,0.8)'; // つるの葉っぱ
  for (var j = 0; j < 3; j++) {
    var lx = x + _tileRnd(r, c, j + 7) * s * 0.85;
    var ly = y + _tileRnd(r, c, j + 10) * s * 0.85;
    ctx.fillRect(lx, ly, s * 0.12, s * 0.08);
  }
  ctx.fillStyle = 'rgba(20,30,15,0.45)'; // 下フチの影
  ctx.fillRect(x, y + s - 3, s, 3);
  ctx.restore();
}

// proc タイルの装飾を下地の上に重ねる（時間 ph でゆれ・ながれ）。
function _drawProcTile(ctx, sprite, x, y, s, ph, r, c) {
  if (sprite === 't_tree')   { _drawTreeTile(ctx, x, y, s, ph); return; }
  if (sprite === 't_rock')   { _drawRockTile(ctx, x, y, s); return; }
  if (sprite === 't_flower') { _drawFlowerTile(ctx, x, y, s, r, c, ph); return; }
  if (sprite === 't_river')  { _drawRiverFlow(ctx, x, y, s, ph); return; }
  if (sprite === 't_bridge') { _drawBridgeTile(ctx, x, y, s); return; }
}

// 森の木：草の上に、丸い樹冠＋幹＋影。風で樹冠がそよぐ。
function _drawTreeTile(ctx, x, y, s, ph) {
  var cx = x + s / 2;
  var sway = Math.sin(ph) * (s * 0.025);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath(); ctx.ellipse(cx, y + s * 0.88, s * 0.30, s * 0.10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b4a2b'; // 幹
  ctx.fillRect(cx - s * 0.06, y + s * 0.52, s * 0.12, s * 0.34);
  function blob(dx, dy, rr, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + dx + sway, y + dy, rr, 0, Math.PI * 2); ctx.fill(); }
  blob(-s * 0.17, s * 0.40, s * 0.19, '#2f7d3a');
  blob( s * 0.17, s * 0.40, s * 0.19, '#2f7d3a');
  blob(0,         s * 0.30, s * 0.25, '#379447');
  blob(-s * 0.07, s * 0.24, s * 0.11, '#5fc468'); // ハイライト
  ctx.restore();
}

// 岩：草の上に、明るい面と影の面のある立体的な石。
function _drawRockTile(ctx, x, y, s) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath(); ctx.ellipse(x + s * 0.5, y + s * 0.82, s * 0.30, s * 0.10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7d7f86';
  ctx.beginPath();
  ctx.moveTo(x + s * 0.22, y + s * 0.78);
  ctx.lineTo(x + s * 0.30, y + s * 0.34);
  ctx.lineTo(x + s * 0.56, y + s * 0.26);
  ctx.lineTo(x + s * 0.80, y + s * 0.46);
  ctx.lineTo(x + s * 0.80, y + s * 0.78);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9a9ca3'; // 明るい面
  ctx.beginPath();
  ctx.moveTo(x + s * 0.30, y + s * 0.34);
  ctx.lineTo(x + s * 0.56, y + s * 0.26);
  ctx.lineTo(x + s * 0.52, y + s * 0.52);
  ctx.lineTo(x + s * 0.34, y + s * 0.54);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5f6166'; // 影の面
  ctx.beginPath();
  ctx.moveTo(x + s * 0.56, y + s * 0.26);
  ctx.lineTo(x + s * 0.80, y + s * 0.46);
  ctx.lineTo(x + s * 0.80, y + s * 0.78);
  ctx.lineTo(x + s * 0.54, y + s * 0.66);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// 花畑：草の上に、色とりどりの小花を決定論ハッシュで散らす（そよ風でゆれる）。
function _drawFlowerTile(ctx, x, y, s, r, c, ph) {
  var cols = ['#ff6b9d', '#ffd23f', '#ff9f43', '#a55eea', '#ffffff'];
  ctx.save();
  for (var i = 0; i < 5; i++) {
    var h1 = _hash01(r * 97 + c * 31 + i * 7 + 1);
    var h2 = _hash01(r * 53 + c * 17 + i * 13 + 2);
    var fx = x + s * (0.18 + h1 * 0.64);
    var fy = y + s * (0.34 + h2 * 0.50);
    var bob = Math.sin(ph + i) * (s * 0.02);
    var col = cols[i % cols.length];
    ctx.strokeStyle = '#3f8f43';
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath(); ctx.moveTo(fx, fy + s * 0.10); ctx.lineTo(fx, fy + bob); ctx.stroke();
    var pr = s * 0.052;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(fx - pr, fy + bob, pr, 0, Math.PI * 2);
    ctx.arc(fx + pr, fy + bob, pr, 0, Math.PI * 2);
    ctx.arc(fx, fy - pr + bob, pr, 0, Math.PI * 2);
    ctx.arc(fx, fy + pr + bob, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe066';
    ctx.beginPath(); ctx.arc(fx, fy + bob, pr * 0.7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// 川のながれ：水の下地の上に、横へ流れる白いさざ波の帯を重ねる。
function _drawRiverFlow(ctx, x, y, s, ph) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip();
  ctx.fillStyle = 'rgba(52,124,196,0.34)'; // 流れる川は水たまりより明るい青
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(208,238,255,0.5)';
  for (var i = 0; i < 3; i++) {
    var yy = y + s * (0.22 + i * 0.3);
    var off = (((ph * 0.6 + i * 0.5) % 1) + 1) % 1;
    var bx = x + off * s - s * 0.2;
    ctx.beginPath(); ctx.ellipse(bx, yy, s * 0.18, s * 0.05, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(bx + s * 0.5, yy + s * 0.12, s * 0.13, s * 0.04, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// 木の橋：水の下地の上に、よこ板を渡して左右に手すり。すきまから川がのぞく。
function _drawBridgeTile(ctx, x, y, s) {
  ctx.save();
  var planks = 5, pw = s / planks;
  for (var i = 0; i < planks; i++) {
    ctx.fillStyle = (i % 2 === 0) ? '#b5803f' : '#9c6a36';
    ctx.fillRect(x, y + i * pw + 1, s, pw - 2);
  }
  ctx.fillStyle = '#7a4f28'; // 手すり（左右の縁）
  ctx.fillRect(x, y, s * 0.12, s);
  ctx.fillRect(x + s - s * 0.12, y, s * 0.12, s);
  ctx.restore();
}

// ── 彩りレイヤー（弾2の続き・Phase2）：色トーン＋ビネット＋いきもの ─────────────
//   タイルや当たり判定には触れず、画面全体にうっすら色を重ねて「時間帯/天気」を出す。

// テーマ別の色トーン。マップ全体に重ねる色を返す（純粋関数＝テスト対象）。
//   夜=深い青／雨=くもりの青灰／雪=ひんやり青白／火の粉=暗い赤／空=明るい水色…。
//   '' は色を足さない（未知テーマ）。petals はごく薄い桜色。
function _toneFor(theme) {
  switch (theme) {
    case 'night':  return 'rgba(26,38,86,0.38)';
    case 'rain':   return 'rgba(58,78,108,0.30)';
    case 'snow':   return 'rgba(206,224,255,0.32)';
    case 'embers': return 'rgba(122,36,18,0.30)';
    case 'sky':    return 'rgba(150,210,255,0.16)';
    case 'sand':   return 'rgba(224,184,96,0.24)';
    case 'leaves': return 'rgba(196,132,52,0.22)';
    case 'forest': return 'rgba(40,110,60,0.18)';
    case 'petals': return 'rgba(255,214,236,0.10)';
    default:       return '';
  }
}

// 色トーン＋周辺減光（ビネット）を画面全体に重ねる＝奥行きと空気感。
//   dark マップは別途たいまつ演出があるのでビネットは省く（二重に暗くしない）。
//   夜/空はゆっくり流れる光の帯（投光器/朝の光）を一本そえて動きを足す。
function _drawToneOverlay(ctx, theme, VW, VH, phase, isDark) {
  ctx.save();
  var wash = _toneFor(theme);
  if (wash) { ctx.fillStyle = wash; ctx.fillRect(0, 0, VW, VH); }
  if (theme === 'night' || theme === 'sky') {
    var span = VW + 320;
    var bx = ((phase * 9) % span) - 160;
    var lc = (theme === 'night') ? '255,244,200' : '255,255,255';
    var lg = ctx.createLinearGradient(bx - 100, 0, bx + 100, VH);
    lg.addColorStop(0,   'rgba(' + lc + ',0)');
    lg.addColorStop(0.5, 'rgba(' + lc + ',0.07)');
    lg.addColorStop(1,   'rgba(' + lc + ',0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, VW, VH);
  }
  if (!isDark) {
    var rad = Math.max(VW, VH) * 0.78;
    var vg = ctx.createRadialGradient(VW / 2, VH * 0.46, rad * 0.42, VW / 2, VH / 2, rad);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.24)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  }
  ctx.restore();
}

// いきもの（ちょうちょ/小鳥）がときどき横切る＝マップに生命感。前景にうっすら。
//   位置/速度は _hash01 で固定、はばたきだけ sin で動かす（決定論＝チラつかない）。
function _drawAmbientLife(ctx, theme, VW, VH, phase) {
  ctx.save();
  var i;
  if (theme === 'petals' || theme === 'leaves' || theme === 'forest') {
    var bcols = (theme === 'leaves') ? ['#ffd23f', '#ff9a3c']
      : (theme === 'forest') ? ['#b6e86a', '#fff0a0', '#8ad0ff']
      : ['#ff9ecb', '#fff0a0', '#a6e3ff'];
    var n = (theme === 'leaves') ? 2 : 3;
    for (i = 0; i < n; i++) {
      var bw = VW + 80;
      var bx = (_hash01(i * 3.7) * bw + phase * (15 + i * 5)) % bw - 40;
      var by = 26 + _hash01(i * 6.1) * VH * 0.55 + Math.sin(phase * 1.7 + i) * 13;
      var flap = Math.abs(Math.sin(phase * 7 + i));   // はねの開閉
      var wWid = 2.2 + flap * 4;
      ctx.save(); ctx.translate(bx, by);
      ctx.fillStyle = bcols[i % bcols.length];
      ctx.beginPath();
      if (ctx.ellipse) { ctx.ellipse(-2.4, 0, wWid, 4, 0, 0, Math.PI * 2); } else { ctx.arc(-2, 0, 3, 0, Math.PI * 2); }
      ctx.fill();
      ctx.beginPath();
      if (ctx.ellipse) { ctx.ellipse(2.4, 0, wWid, 4, 0, 0, Math.PI * 2); } else { ctx.arc(2, 0, 3, 0, Math.PI * 2); }
      ctx.fill();
      ctx.fillStyle = '#3a2a3a'; ctx.fillRect(-0.6, -3, 1.2, 6);   // どうたい
      ctx.restore();
    }
  } else if (theme === 'sky' || theme === 'sand') {
    var n2 = (theme === 'sky') ? 3 : 1;
    for (i = 0; i < n2; i++) {
      var bw2 = VW + 100;
      var x = (_hash01(i * 2.3) * bw2 + phase * (20 + i * 6)) % bw2 - 50;
      var y = 22 + _hash01(i * 4.7) * VH * 0.4;
      var wing = 3 + Math.abs(Math.sin(phase * 6 + i)) * 4;   // はばたき
      ctx.strokeStyle = (theme === 'sky') ? 'rgba(70,84,112,0.7)' : 'rgba(90,72,48,0.6)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - 7, y);   ctx.lineTo(x, y - wing);   ctx.lineTo(x + 7, y);   // 右どり「く」
      ctx.moveTo(x + 6, y + 1); ctx.lineTo(x + 12, y - wing * 0.7); ctx.lineTo(x + 18, y + 1);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ── 地面装飾（Phase2 彩り）：芝マスに小さな飾りを散らして「空いたさみしい芝」を埋める ──
//   grid/当たり判定には一切触れず、芝タイル('.'=t_grass)の上にだけ決定論ハッシュで
//   草むら/小花/小石（テーマ別に雪のかたまり・砂の枯れ草・残り火など）を置く。
//   キャラより下に描く地面デカール。草と花の先端はそよぐ。dark マップは省略。

// テーマ別の小花カラーパレット（季節感）。
function _decorPalette(theme) {
  switch (theme) {
    case 'leaves': return ['#e6a13a', '#d8743a', '#e8c24a', '#c98a3e'];   // 秋色
    case 'snow':   return ['#bcd3ef', '#d9e8fb', '#a7c4e6'];               // 寒色
    case 'sand':   return ['#e7c879', '#d9a85a', '#c79a52'];               // 砂漠
    case 'sky':    return ['#bfe6ff', '#ffffff', '#ffe6a0'];               // 高原
    case 'night':  return ['#9ec8ff', '#c8b0ff', '#fff0a0'];               // 夜に映える
    case 'embers': return ['#ff9a5a', '#ffd06a', '#e06030'];               // 火の色
    case 'forest': return ['#9ad36a', '#e8e26a', '#c0e88a', '#7bbf52'];   // もりの 草花
    default:       return ['#ff8fc4', '#fff0a0', '#a6e3ff', '#ff6f9a', '#c08bff']; // 春の花畑
  }
}

// 1マス分の飾りを 1 個描く。sel(0..1) で種類を、pal で花色を決める。ph で先端がそよぐ。
function _decorSprite(ctx, theme, sel, x, y, ph, pal) {
  var sway = Math.sin(ph) * 1.6;
  // テーマ固有の飾り（先に判定）。
  if (theme === 'snow' && sel < 0.4) {                 // 雪のかたまり
    ctx.fillStyle = 'rgba(60,80,110,0.16)';
    if (ctx.ellipse) { ctx.beginPath(); ctx.ellipse(x, y + 2, 6, 2.2, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#f2f7ff';
    ctx.beginPath();
    ctx.arc(x - 2.6, y, 3.1, 0, Math.PI * 2);
    ctx.arc(x + 2.6, y, 3.5, 0, Math.PI * 2);
    ctx.arc(x, y - 2, 3.3, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (theme === 'sand' && sel < 0.5) {                 // 砂の枯れ草 / 小石
    if (sel < 0.25) {
      ctx.strokeStyle = '#b79152'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      for (var b = -1; b <= 1; b++) {
        ctx.beginPath(); ctx.moveTo(x + b * 2, y + 4);
        ctx.quadraticCurveTo(x + b * 3 + sway, y - 2, x + b * 4 + sway, y - 6); ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#c9b48a';
      if (ctx.ellipse) { ctx.beginPath(); ctx.ellipse(x, y, 4, 2.6, 0, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#e3d4ad'; ctx.beginPath(); ctx.arc(x - 1, y - 1, 1.3, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }
  if (theme === 'embers' && sel < 0.45) {              // こげた石＋残り火
    ctx.fillStyle = '#3a2620';
    if (ctx.ellipse) { ctx.beginPath(); ctx.ellipse(x, y, 4, 2.6, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
    var eg = 0.35 + 0.55 * Math.abs(Math.sin(ph * 2.2));
    ctx.fillStyle = 'rgba(255,140,50,' + eg.toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(x, y - 1, 1.3, 0, Math.PI * 2); ctx.fill();
    return;
  }
  // 共通：草むら / 小花 / 小石。
  if (sel < 0.42) {                                    // 草むら（数本のブレード）
    var gcol = (theme === 'night') ? '#3f6b4a' : (theme === 'leaves') ? '#6f7d3a' : '#4f9a4a';
    ctx.strokeStyle = gcol; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (var k = -2; k <= 2; k++) {
      var bx = x + k * 1.8;
      ctx.beginPath(); ctx.moveTo(bx, y + 4);
      ctx.quadraticCurveTo(bx + sway * 0.5, y - 2, bx + sway + k * 0.5, y - 7);
      ctx.stroke();
    }
  } else if (sel < 0.8) {                              // 小花（茎＋花びら5枚＋しん）
    var col = pal[Math.floor(_hash01(x * 1.7 + y * 2.3) * pal.length) % pal.length];
    ctx.strokeStyle = '#3f7a44'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.quadraticCurveTo(x + sway * 0.4, y, x + sway, y - 3); ctx.stroke();
    var hx = x + sway, hy = y - 4;
    ctx.fillStyle = col;
    for (var p = 0; p < 5; p++) {
      var ang = p * (Math.PI * 2 / 5);
      ctx.beginPath(); ctx.arc(hx + Math.cos(ang) * 2.4, hy + Math.sin(ang) * 2.4, 1.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffe98a'; ctx.beginPath(); ctx.arc(hx, hy, 1.5, 0, Math.PI * 2); ctx.fill();
  } else {                                             // 小石
    ctx.fillStyle = '#9aa0a6';
    if (ctx.ellipse) { ctx.beginPath(); ctx.ellipse(x, y, 3.4, 2.2, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#c2c7cc'; ctx.beginPath(); ctx.arc(x - 1, y - 0.8, 1.1, 0, Math.PI * 2); ctx.fill();
  }
}

// 可視範囲の芝マスだけを走査し、約 1/3 のマスに飾りを 1 個ずつ置く。
function _drawGroundDecor(ctx, map, theme, c0, c1, r0, r1, offX, offY, TS, legend, phase) {
  if (!map || map.dark) return;
  var grid = map.grid; if (!grid) return;
  var pal = _decorPalette(theme);
  ctx.save();
  for (var r = r0; r <= r1; r++) {
    var rowStr = grid[r]; if (!rowStr) continue;
    for (var c = c0; c <= c1; c++) {
      var leg = legend[rowStr[c]];
      if (!leg || leg.sprite !== 't_grass') continue;
      if (_hash01(c * 12.31 + r * 7.93 + 3.7) > 0.34) continue;   // ~34% のマスに飾り
      var ox = 5 + _hash01(c * 3.11 + r * 9.67) * (TS - 12);
      var oy = 7 + _hash01(c * 8.41 + r * 2.63) * (TS - 14);
      var sel = _hash01(c * 5.77 + r * 4.19 + 1.3);
      _decorSprite(ctx, theme, sel, offX + c * TS + ox, offY + r * TS + oy,
        phase + c * 0.7 + r * 0.5, pal);
    }
  }
  ctx.restore();
}

// ── マップ切替演出の純粋関数（弾2・機能⑥）─────────────────────
// 黒オーバーレイ不透明度 0..1。remain=残りフェード秒, total=フェード全体秒。
function fadeAlpha(remain, total) {
  if (!total || total <= 0) return 0;
  var a = remain / total;
  if (a < 0) return 0;
  if (a > 1) return 1;
  return a;
}
// マップ名フラッシュ不透明度 0..1。残り40%地点までは 1、そこから線形に 0 へ。
function flashAlpha(remain, total) {
  if (!total || total <= 0) return 0;
  if (remain <= 0) return 0;
  if (remain >= total) return 1;
  var fadeStart = total * 0.4;
  if (remain >= fadeStart) return 1;
  return remain / fadeStart;
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

  // 弾7-④:訪問記録（世界地図・ファストトラベルの解禁判定に使う）。古いセーブは || {} で初期化。
  if (state) {
    state.visited = state.visited || {};
    if (pos && pos.map) state.visited[pos.map] = true;
  }

  // ── このマップで流すステージBGM名（audio.js の SRPG_BGM のキー）──
  //   ambient は通常マップにも付くので判定には使わず、マップ名と dark で決める。
  //   町/村＝'town'、洞窟/塔/神殿/城/dark＝'dungeon'、それ以外＝'field'。
  var _bgmName = (function () {
    var id = String(pos.map || '');
    if (/town|village/.test(id)) return 'town';
    if (map.dark || /cave|tower|shrine|castle|dungeon/.test(id)) return 'dungeon';
    return 'field';
  })();

  // このマップ入場時に一度だけ流すカットシーン（イベント・弾4）。
  // update の最初に未再生なら再生する。再生したら flag を立てて二度は出さない。
  var _cutscene = pendingCutscene(rawMap, (state && state.flags) || {});

  // ── プレイヤー状態 ───────────────────────────────────────────────
  var px = (pos.x !== undefined && pos.x !== null) ? pos.x : 5;
  var py = (pos.y !== undefined && pos.y !== null) ? pos.y : 5;
  var facing = 'down';
  var moveTimer = 0;
  // 弾7-①：描画補間状態（px/py は整数マスのまま。表示だけ moveFromX→px を lerp する）
  var moveFromX = px;
  var moveFromY = py;
  var moveProg = 1; // 1 = 補間完了（静止）

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
      fromX: px, fromY: py, // 弾7-①：描画補間用の移動元マス
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

  // ── マップ切替の入場演出（弾2・機能⑥）＝描画専用・毎回の再生成で自動開始 ──
  var FADE_TIME = 0.35;        // 黒→透明のフェード秒
  var NAME_FLASH_TIME = 1.4;   // マップ名を大きく出す秒
  var _enterFade = FADE_TIME;       // 残りフェード秒（FADE_TIME→0）
  var _nameFlash = NAME_FLASH_TIME; // 残りフラッシュ秒（NAME_FLASH_TIME→0）

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

    // ⓪ 進行ロック（第3章の試合ゲート等）：requireFlag 未達なら lockedMsg を出して止める。
    //    ただし すでに クリア済み（winFlag が立っている）NPC は「もう すんだ相手」として素通しする。
    if (npc.requireFlag && !(state.flags && state.flags[npc.requireFlag])) {
      var _cleared = !!(npc.boss && npc.boss.winFlag && state.flags && state.flags[npc.boss.winFlag]);
      if (!_cleared) {
        S.pushScene(S.createDialog([npc.lockedMsg || 'まだ さきへは すすめないようだ…']));
        return;
      }
    }

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
        // 自己修復（A-3の保険）：万一 joined_ フラグ欠けのセーブでも、話しかければ回復する。
        if (!state.flags) state.flags = {};
        state.flags['joined_' + npc.joinId] = true;
        if (npc.vanishFlag) state.flags[npc.vanishFlag] = true;
        if (S.saveGame) S.saveGame(state);
        S.pushScene(S.createDialog(npc.afterPages || ['いっしょに がんばろう！']));
        return;
      }
      // 会話 → 加入ミニストーリー → 加入処理 → カットイン → フィールド再構築（NPC を消す）
      var convo = (npc.pages || []).concat(npc.joinStory || []);
      S.pushScene(S.createDialog(convo, { onComplete: function () {
        if (typeof S.joinAlly === 'function') S.joinAlly(state, npc.joinId);
        if (!state.flags) state.flags = {};
        if (npc.vanishFlag) state.flags[npc.vanishFlag] = true;
        if (S.saveGame) S.saveGame(state);
        var back = function () { if (S.replaceScene) S.replaceScene(S.createFieldScene(state)); };
        if (typeof S.createJoinCutinScene === 'function') {
          S.pushScene(S.createJoinCutinScene(state, npc.joinId, back));
        } else {
          S.pushScene(S.createDialog([(npc.joinId || 'なかま') + ' が なかまに なった！'], { onComplete: back }));
        }
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
          setFlag: b.setFlag, afterPages: b.afterPages,
          warpTo: b.warpTo, warpX: b.warpX, warpY: b.warpY,
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

    // ⑦.2 リフティング ミニゲーム（機能③）：コーチに話すと リフティングに ちょうせん。
    //    しょうりで winFlag＋ごほうび（初回のみ）。2回目以降は ごほうび無しで 何度でも あそべる。
    if (npc.lifting) {
      var lf = npc.lifting;
      var lfFlags = state.flags || {};
      var lfWonBefore = !!(lf.winFlag && lfFlags[lf.winFlag]);
      var lfIntro = lfWonBefore ? (npc.afterPages || ['また リフティングで あそぼう！']) : (npc.pages || ['リフティングに ちょうせん する？']);
      S.pushScene(S.createDialog(lfIntro, { onComplete: function () {
        S.pushScene(S.createLiftingScene(state, { target: lf.target, lives: lf.lives, onComplete: function (win, count) {
          if (win && !lfWonBefore) {
            if (!state.flags) state.flags = {};
            if (lf.winFlag) state.flags[lf.winFlag] = true;
            var summary = (lf.reward && typeof S.grantReward === 'function') ? S.grantReward(state, lf.reward) : '';
            if (S.saveGame) S.saveGame(state);
            var msg = summary ? ('かった！ ' + count + 'かい！\nごほうびに ' + summary + 'を もらった！') : ('かった！ ' + count + 'かい！');
            S.pushScene(S.createDialog([msg]));
          } else if (win) {
            S.pushScene(S.createDialog(['また かった！ ' + count + 'かい！\nみごとな あしさばき だ！']));
          } else {
            S.pushScene(S.createDialog(['ざんねん… ' + count + 'かい。\nまた ちょうせんしてね！']));
          }
        } }));
      } }));
      return;
    }

    // ⑦.3 まとあて シュート ミニゲーム（機能③）：コーチに話すと まとあてに ちょうせん。
    //    しょうりで winFlag＋ごほうび（初回のみ）。2回目以降は ごほうび無しで 何度でも あそべる。
    if (npc.shoot) {
      var sh = npc.shoot;
      var shFlags = state.flags || {};
      var shWonBefore = !!(sh.winFlag && shFlags[sh.winFlag]);
      var shIntro = shWonBefore ? (npc.afterPages || ['また まとあてで あそぼう！']) : (npc.pages || ['まとあてに ちょうせん する？']);
      S.pushScene(S.createDialog(shIntro, { onComplete: function () {
        S.pushScene(S.createShootScene(state, { target: sh.target, shots: sh.shots, onComplete: function (win, hits) {
          if (win && !shWonBefore) {
            if (!state.flags) state.flags = {};
            if (sh.winFlag) state.flags[sh.winFlag] = true;
            var summary = (sh.reward && typeof S.grantReward === 'function') ? S.grantReward(state, sh.reward) : '';
            if (S.saveGame) S.saveGame(state);
            var msg = summary ? ('かった！ ' + hits + 'ヒット！\nごほうびに ' + summary + 'を もらった！') : ('かった！ ' + hits + 'ヒット！');
            S.pushScene(S.createDialog([msg]));
          } else if (win) {
            S.pushScene(S.createDialog(['また かった！ ' + hits + 'ヒット！\nすばらしい シュートだ！']));
          } else {
            S.pushScene(S.createDialog(['ざんねん… ' + hits + 'ヒット。\nまた ちょうせんしてね！']));
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

    // ⑦.9 案内コーチ（進行ナビ）：いま むかうべき もくひょうを フルで おしえる。
    if (npc.guide) {
      var gpages = [];
      if (typeof S.objectiveFor === 'function') {
        var ob = S.objectiveFor((state && state.flags) || {});
        if (ob && ob.npc) gpages.push(ob.npc);
      }
      if (npc.pages && npc.pages.length) gpages = gpages.concat(npc.pages);
      if (!gpages.length) gpages = ['げんきに がんばろう！'];
      S.pushScene(S.createDialog(gpages));
      return;
    }

    // ⑧ 通常会話（進行で変わる variants に対応）
    S.pushScene(S.createDialog(npcPagesFor(npc, (state && state.flags) || {})));
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
      if (S.playSe) S.playSe('treasure'); // 宝箱オープンのキラキラ音
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
    // 弾7-①：シフト前に各仲間の現在マスを移動元として退避（このマスから次マスへ lerp する）
    for (var f = 0; f < followers.length; f++) {
      followers[f].fromX = followers[f].x;
      followers[f].fromY = followers[f].y;
    }
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
    // 弾7-①：リーダーの移動元＝旧px/py。ここから nx/ny へ補間する。
    moveFromX = px; moveFromY = py; moveProg = 0;
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
      followers[k].fromX = px; followers[k].fromY = py; // 弾7-①：ワープは補間なし
    }
    // 弾7-①：ワープは即座に到達済み扱い（moveProg=1）＝切替演出と競合させない
    moveFromX = px; moveFromY = py; moveProg = 1;
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

      // 入場演出の減衰（描画専用・ゲーム進行に非干渉）
      if (_enterFade > 0) _enterFade -= dt;
      if (_nameFlash > 0) _nameFlash -= dt;

      // ステージBGMを毎フレーム保証（同じ曲なら playBgm は即 return＝軽い）。
      // 戦闘やメニューから戻った直後も、ここで自分のBGMへ復帰する。
      if (S.playBgm) S.playBgm(_bgmName);

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

      // 弾7-①：移動補間を進める（STEP_TIME で 0→1）
      if (moveProg < 1) {
        moveProg += dt / STEP_TIME;
        if (moveProg > 1) moveProg = 1;
      }

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
        if (S.playSe) S.playSe('stairs');
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
      // 弾7-①：表示座標＝移動元→現在マスの補間。カメラ・キャラ描画はこれを使う。
      var _rt = stepEase(moveProg);
      var renderX = lerp(moveFromX, px, _rt);
      var renderY = lerp(moveFromY, py, _rt);
      var offX = clampCamera(Math.round(VW / 2 - (renderX * TS + TS / 2)), VW, mapW);
      var offY = clampCamera(Math.round(VH / 2 - (renderY * TS + TS / 2)), VH, mapH);

      // 演出の時間軸。draw のはじめで 1 回だけ進め、雲/天候/水面/宝箱/ワープが
      // 同じ位相を共有する（決定論的＝チラつかない）。
      _gfx += 0.06;
      var theme = _ambientFor(map);

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
          // 弾6：森/川/橋/岩/花はコードで手描き＝まず下地（草 or 水）を敷く。
          var proc = _isProcTile(t.sprite);
          var baseSprite = proc ? _procBaseSprite(t.sprite) : t.sprite;
          var wphase = _gfx + (r * 7 + c * 3) * 0.35;
          // Phase7-①：下地はコードで手描き（AI絵タイルは卒業）。
          //   未対応spriteのときだけ AI絵→ドット絵 の順でフォールバック。
          if (_isBaseTile(baseSprite)) {
            _drawBaseTile(ctx, baseSprite, tx, ty, TS, wphase, r, c);
          } else {
            var aurl = fieldArt && fieldArt[baseSprite];
            var tdrew = aurl && S.drawImageTile(ctx, 'field_' + baseSprite, aurl, tx, ty, TS);
            if (!tdrew) {
              var sp = S.SPRITES[baseSprite];
              if (sp) S.drawSprite(ctx, sp, tx, ty, TS / 16);
            }
          }
          // 水/川の下地の上にひかりの帯をのせる（浅い水・深い水。位相をずらしてさざ波感）。
          if (_isWaterSprite(baseSprite)) {
            _drawWaterShimmer(ctx, tx, ty, TS, wphase);
          }
          // ふちどり（autotile）：地面が水/川にせっする辺へ砂のなぎさを足す＝DQ感。
          if (baseSprite === 't_grass' || baseSprite === 't_sand' ||
              baseSprite === 't_road' || baseSprite === 't_cobble') {
            var em = _waterEdgeMask(map.grid, r, c);
            if (em) _drawShoreEdges(ctx, tx, ty, TS, em);
          }
          // 森/川/橋/岩/花の装飾を下地の上に重ねる（時間で ゆれ/ながれ）。
          if (proc) _drawProcTile(ctx, t.sprite, tx, ty, TS, _gfx + (r * 13 + c * 7) * 0.21, r, c);
        }
      }

      // 3.2 空レイヤー（流れ雲・雲かげ・星）。地面の上・キャラの下にうっすら重ねて奥行きを出す。
      _drawSkyLayer(ctx, theme, VW, VH, _gfx);

      // 3.4 地面装飾（彩り）：芝マスに草むら/小花/小石を散らして空いた芝を埋める。
      //      grid/当たり判定には触れず、決定論ハッシュで配置。キャラの下に描く地面デカール。
      _drawGroundDecor(ctx, map, theme, c0, c1, r0, r1, offX, offY, TS, legend, _gfx);

      // 3.5 地面デカール（踏める飾り：ボール/花）。地面に貼るので全員の下に描く。
      var objArt = S.OBJ_ART || null;
      var groundObjs = map.objects || [];
      for (var gi = 0; gi < groundObjs.length; gi++) {
        var go = groundObjs[gi];
        if (go.type !== 'ball' && go.type !== 'flower' && go.type !== 'crop') continue;
        if (go.x < c0 - 1 || go.x > c1 + 1 || go.y < r0 - 1 || go.y > r1 + 1) continue;
        _drawFieldObject(ctx, S, go.type, offX + go.x * TS, offY + go.y * TS, TS, objArt, _gfx + go.x * 0.5 + go.y * 0.3);
      }

      // 3.6 ギミックの地面マーカー（弾2）：ワープパネル/動く床/パズルのゴール印。
      //      いずれも地面に貼るので全員の下（足元）に描く。可視範囲だけカリング。
      //      位相 _gfx は draw 先頭で進め済み（雲/天候/水面と共有）。
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

      // 4. 宝箱（未開封＝光の輪＋立体感＋✦点滅／開封済み＝薄い空箱）
      var chests = map.chests || [];
      for (var ci = 0; ci < chests.length; ci++) {
        var ch = chests[ci];
        var sx = offX + ch.x * TS, sy = offY + ch.y * TS;
        if (opened[ch.id]) { _drawOpenedChest(ctx, sx, sy, TS); continue; }
        // 足元にやわらかい光の輪＝遠くからでも「宝がある」がわかる
        _drawChestAura(ctx, sx, sy, TS, _gfx + ci * 1.3);
        ctx.fillStyle = '#8a5a2e'; ctx.fillRect(sx + 5, sy + 13, TS - 10, TS - 15);
        ctx.fillStyle = '#a86b34'; ctx.fillRect(sx + 5, sy + 9, TS - 10, 7);
        ctx.fillStyle = '#ffd76e';
        ctx.fillRect(sx + TS / 2 - 2, sy + 9, 4, TS - 12);
        ctx.fillRect(sx + 5, sy + 15, TS - 10, 3);
        // 軽い陰影（上ハイライト＋下の影）で立体感を出す
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(sx + 5, sy + 9, TS - 10, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(sx + 5, sy + TS - 5, TS - 10, 2);
        ctx.strokeStyle = '#3a230f'; ctx.lineWidth = 1;
        ctx.strokeRect(sx + 5, sy + 9, TS - 10, TS - 13);
        // 未開封の宝の上で ✦ がチカチカ＝「ここに何かあるよ」のサイン。
        _drawChestGlow(ctx, sx, sy, TS, _gfx + ci * 1.7);
      }

      // 5. NPC（＋頭上マーク＝話せる人/お店/鍛冶/仲間/ボス/クエストを一目でわかるように）
      //    AI差し替えフック：S.NPC_ART[npc.sprite] に dataURL があれば drawImageSprite で
      //    優先描画し、無ければ従来の色替えドット絵(SPRITES)へ自動フォールバック。
      //    npc-art（field-art.js の NPC_ART）を足すだけでコード変更ゼロでAI絵に切り替わる
      //    （OBJ_ART / WALK_ART と同じ思想）。NPCは静止＝正面1枚でよい。
      var npcArt = S.NPC_ART || null;
      var npcs = map.npcs || [];
      for (var ni = 0; ni < npcs.length; ni++) {
        var npc = npcs[ni];
        var nsp = S.SPRITES[npc.sprite];
        S.drawShadow(ctx, offX + npc.x * TS + TS / 2, offY + npc.y * TS + TS - 3, 10, 4);
        var drewNpcAI = false;
        if (npcArt && npcArt[npc.sprite] && typeof S.drawImageSprite === 'function') {
          var npcBoxH = TS * 1.35;                       // タイルより少し大きい存在感（隊列と同スケール）
          drewNpcAI = S.drawImageSprite(ctx, 'npc_' + npc.sprite, npcArt[npc.sprite],
                        offX + npc.x * TS + TS / 2, offY + npc.y * TS + TS - npcBoxH / 2 + 2, npcBoxH, false);
        }
        if (!drewNpcAI && nsp) S.drawSprite(ctx, nsp, offX + npc.x * TS, offY + npc.y * TS, 1);
        var mkind = npcMarkerKind(npc, state);
        if (mkind !== 'none') {
          _drawNpcMarker(ctx, mkind, offX + npc.x * TS, offY + npc.y * TS, TS, _gfx + ni * 0.6);
        }
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
          rx: lerp(fo.fromX, fo.x, _rt), ry: lerp(fo.fromY, fo.y, _rt), // 弾7-①：補間表示座標
          isMonster: fo.isMonster, baseId: fo.baseId,
        });
      }
      actors.push({
        id: (party[0] && party[0].id) || 'yuito',
        x: px, y: py, facing: facing, isLeader: true,
        rx: renderX, ry: renderY, // 弾7-①：補間表示座標
        isMonster: party[0] && party[0].isMonster, baseId: party[0] && party[0].baseId,
      });
      // ソリッド/背の高い飾り（木/ゴール/ベンチ/看板/茂み）も同じ Y ソートに混ぜる。
      //   画面下にいる者ほど手前＝プレイヤーが木の前に立てば木に隠れ、下なら手前。
      var solidObjs = map.objects || [];
      for (var soi = 0; soi < solidObjs.length; soi++) {
        var sob = solidObjs[soi];
        if (sob.type === 'ball' || sob.type === 'flower' || sob.type === 'crop') continue; // 地面デカールは描画済み
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
          _drawFieldObject(ctx, S, act.objType, osx, osy, TS, objArt, _gfx + act.x * 0.5 + act.y * 0.3);
          continue;
        }
        // 押しブロック（サッカーボール）：影＋ボール本体（弾2）。
        if (act.kind === 'pushball') {
          var bsx = offX + act.x * TS, bsy = offY + act.y * TS;
          S.drawShadow(ctx, bsx + TS / 2, bsy + TS - 4, 9, 4);
          _drawPushBall(ctx, bsx, bsy, TS);
          continue;
        }
        // 弾7-①：キャラは補間表示座標を使う（無い actor は整数マスにフォールバック）
        var _ax = (act.rx !== undefined) ? act.rx : act.x;
        var _ay = (act.ry !== undefined) ? act.ry : act.y;
        var footCX = offX + _ax * TS + TS / 2;         // マス中央
        var footBottom = offY + _ay * TS + TS;         // マス下端＝接地点
        S.drawShadow(ctx, footCX, offY + _ay * TS + TS - 3, act.isLeader ? 11 : 10, 4);
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
          // 横向き(side)素材は1枚を左右反転して両向きに使い回す。素材の実向きはユイトだけ「左向き」・
          // 他4人は「右向き」なので、反転要否は walkSideFlip() に集約（素材と逆向きへ歩くとき反転）。
          var dKey = act.id + ((act.facing === 'up') ? '_up'
                            : (act.facing === 'down') ? '_down'
                            : '_side');
          var fl = walkSideFlip(act.id, act.facing);
          var wu = walkArt[dKey];
          if (wu) {
            var bH = TS * 1.35;                          // タイルより少し大きい存在感
            drew = S.drawImageSprite(ctx, 'walk_' + dKey, wu, footCX, footBottom - bH / 2 + 2, bH, fl);
          }
        }
        if (!drew) {
          var dotSp = S.SPRITES[act.id] || S.SPRITES.yuito;
          S.drawSprite(ctx, dotSp, offX + _ax * TS, offY + _ay * TS, 1);
        }
      }

      // 6.35 彩りトーン（Phase2）：テーマ色＋周辺減光を世界全体に重ねて時間帯/天気の空気感を出す。
      //      キャラの上・天候の下に置くと、夜は青く沈み、火の粉や雨つぶが上で映える。
      _drawToneOverlay(ctx, theme, VW, VH, _gfx, !!map.dark);

      // 6.4 天候レイヤー（前景・キャラの上）：花びら/落ち葉/雨/雪/砂ぼこり/きらめき/
      //     ほたる/火の粉。マップのテーマに合わせて舞わせ、生命感と彩りを足す。
      _drawWeatherLayer(ctx, theme, VW, VH, _gfx);

      // 6.45 いきもの（Phase2）：ちょうちょ/小鳥がときどき横切る＝マップに生命感。
      _drawAmbientLife(ctx, theme, VW, VH, _gfx);

      // 6.5 暗闇オーバーレイ（弾2 dark マップ）：プレイヤー中心の「たいまつ視界」。
      //     ひみつの部屋など map.dark のときだけ、周囲をうっすら照らして探索感を出す。
      if (map.dark) {
        // 弾7-①：たいまつ視界はリーダーの補間表示座標に合わせる（歩行中も光がズレない）
        var tcx = offX + renderX * TS + TS / 2;
        var tcy = offY + renderY * TS + TS / 2;
        // たいまつの炎は一定でなく、ゆらゆら明るさが揺れる（2つの sin を重ねて自然に）。
        var flick = 1 + Math.sin(_gfx * 5) * 0.04 + Math.sin(_gfx * 11 + 1.3) * 0.025;
        var torchR = TS * 4 * flick;
        var grad = ctx.createRadialGradient(tcx, tcy, TS * 0.6, tcx, tcy, torchR);
        grad.addColorStop(0,   'rgba(0,0,0,0)');
        grad.addColorStop(0.6, 'rgba(0,0,0,0.35)');
        grad.addColorStop(1,   'rgba(0,0,0,0.97)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VW, VH);
        // かべの たいまつ（type:'torch'）も まわりを ほんのり 照らす＝暗闇を焼き抜く。
        var _torches = map.objects || [];
        if (_torches.length) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (var ti = 0; ti < _torches.length; ti++) {
            var _t = _torches[ti];
            if (_t.type !== 'torch') continue;
            var lx = offX + _t.x * TS + TS / 2;
            var ly = offY + _t.y * TS + TS / 2;
            var lr = TS * 2.2 * flick;
            var lg = ctx.createRadialGradient(lx, ly, 2, lx, ly, lr);
            lg.addColorStop(0,   'rgba(255,170,60,0.55)');
            lg.addColorStop(0.5, 'rgba(255,120,30,0.22)');
            lg.addColorStop(1,   'rgba(255,90,20,0)');
            ctx.fillStyle = lg;
            ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        }
      }

      // 7. ネームプレート（画面上部）
      S.drawWindow(ctx, VW / 2 - 60, 6, 120, 24, { radius: 8, border: '#5ec8ff' });
      S.drawText(ctx, map.name, VW / 2, 12, { size: 13, color: '#dff4ff', align: 'center' });

      // 8. つぎの もくひょう バー（進行ナビ：いま どこへ いけば いいか 常設表示）
      if (typeof S.objectiveFor === 'function') {
        var _ob = S.objectiveFor((state && state.flags) || {});
        if (_ob && _ob.bar) _drawObjectiveBar(ctx, S, _ob.bar);
      }

      // 9. 弾7-②：ミニマップ（右上・常時）。目標バーがある時は下にずらす。
      var _mmY0 = (typeof _ob !== 'undefined' && _ob && _ob.bar) ? 58 : 6;
      _drawMinimap(ctx, S, map, px, py, VW, _gfx, _mmY0);

      // 10. 弾7-③：行き先看板（出口に近づいたら下部に「→ ○○へ」）
      if (typeof nearestExitLabel === 'function' && S.MAPS) {
        var _sign = nearestExitLabel(map, px, py, 2, S.MAPS);
        if (_sign) _drawSignpost(ctx, S, _sign, VW, VH);
      }

      // ── マップ切替の入場演出（最前面）──────────────────────────
      var _fa = fadeAlpha(_enterFade, FADE_TIME);
      if (_fa > 0) {
        ctx.fillStyle = 'rgba(0,0,0,' + _fa + ')';
        ctx.fillRect(0, 0, VW, VH);
      }
      var _na = flashAlpha(_nameFlash, NAME_FLASH_TIME);
      if (_na > 0) {
        ctx.save();
        ctx.globalAlpha = _na;
        // 半透明の帯＋大きなマップ名（常設の小さいネームプレートとは別物）
        ctx.fillStyle = 'rgba(6,10,28,0.72)';
        ctx.fillRect(0, VH / 2 - 30, VW, 60);
        S.drawText(ctx, map.name, VW / 2, VH / 2 - 12, { size: 24, color: '#ffe9a8', align: 'center' });
        ctx.restore();
      }
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

/**
 * createJoinCutinScene — 仲間加入カットイン（物語編B）
 *   暗転 → 金の放射光＋パーティクル → ALLY_ART 立ち絵がスケールイン →
 *   「⚡○○が なかまに なった！」＋ポジション・タイプ色・ひとこと。
 *   開始時に 加入ファンファーレSE 'join' を鳴らす。confirm/タップ で onClose。
 *   立ち絵の描画は なかま ずかん（title-scene）と同じ ALLY_ART→drawImageSprite→SPRITES の順。
 * @param {object} state ゲーム状態（読み取りのみ）
 * @param {string} allyId 加入した仲間の id（characters.js のキー）
 * @param {function} onClose 閉じたときに呼ぶ（フィールド復帰など）
 * @returns {object} シーン（update/draw/isDone/_debug）
 */
function createJoinCutinScene(state, allyId, onClose) {
  var S = (typeof window !== 'undefined' ? window : globalThis).SRPG;
  var VW = S.VW, VH = S.VH;
  var ch = (S.CHARACTERS && S.CHARACTERS[allyId]) || null;
  var pf = (ch && ch.profile) || {};
  var typeColors = { power: '#ff8a5c', speed: '#5cd0ff', technique: '#b98aff' };
  var typeNames  = { power: 'パワー',  speed: 'スピード', technique: 'テクニック' };
  var accent = (ch && typeColors[ch.type]) || '#ffd76e';

  var _t = 0;         // 経過時間（スケールイン・放射光の回転に使う）
  var _done = false;
  var _seDone = false;

  function _finish() {
    if (_done) return;
    _done = true;
    if (typeof onClose === 'function') onClose();
  }

  return {
    update: function (dt, input) {
      _t += dt;
      if (!_seDone) { _seDone = true; if (S.playSe) S.playSe('join'); }
      var pressed = (input && input.pressed) || {};
      // 立ち絵が出そろってから（0.5s〜）閉じられる
      if (_t >= 0.5 && (pressed.confirm || pressed.cancel)) _finish();
    },

    draw: function (ctx) {
      // 1. 暗転
      ctx.fillStyle = 'rgba(3,5,12,0.92)';
      ctx.fillRect(0, 0, VW, VH);

      var cx = VW / 2, cy = 150;

      // 2. 金の放射光（中心から回転）
      var rays = 14, rot = _t * 0.6;
      for (var i = 0; i < rays; i++) {
        var a = rot + (i / rays) * Math.PI * 2;
        ctx.fillStyle = (i % 2 === 0) ? 'rgba(255,216,110,0.16)' : 'rgba(255,216,110,0.06)';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 360, cy + Math.sin(a) * 360);
        ctx.lineTo(cx + Math.cos(a + 0.24) * 360, cy + Math.sin(a + 0.24) * 360);
        ctx.closePath();
        ctx.fill();
      }

      // 3. パーティクル（きらきら）
      for (var p = 0; p < 18; p++) {
        var pa = (p / 18) * Math.PI * 2 + _t * 1.4;
        var pr = 60 + ((p * 37) % 90) + Math.sin(_t * 3 + p) * 10;
        var ppx = cx + Math.cos(pa) * pr;
        var ppy = cy + Math.sin(pa) * pr * 0.8;
        ctx.fillStyle = 'rgba(255,240,180,0.9)';
        ctx.fillRect(ppx - 1.5, ppy - 1.5, 3, 3);
      }

      // 4. 立ち絵（スケールイン：高さ 40→130 を 0.35s で）
      var grow = Math.min(1, _t / 0.35);
      var ph = 40 + 90 * grow;
      if (S.drawShadow) S.drawShadow(ctx, cx, cy + ph / 2 - 2, 30 * grow, 7 * grow);
      var art = S.ALLY_ART && S.ALLY_ART[allyId];
      var drew = false;
      if (art && typeof S.drawImageSprite === 'function') {
        drew = S.drawImageSprite(ctx, 'joincut_' + allyId, art, cx, cy, ph, false);
      }
      if (!drew && S.SPRITES && S.SPRITES[allyId] && S.drawSprite) {
        var sp = S.SPRITES[allyId], sc = Math.max(1, Math.round(4 * grow));
        var sw = sp.map[0].length * sc, sh = sp.map.length * sc;
        S.drawSprite(ctx, sp, Math.floor(cx - sw / 2), Math.floor(cy - sh / 2), sc);
      }

      // 5. 「⚡○○が なかまに なった！」
      S.drawText(ctx, '⚡ ' + ((ch && ch.name) || 'なかま') + ' が なかまに なった！', VW / 2, 236, {
        size: 16, color: accent, align: 'center', weight: 'bold', shadow: true,
      });

      // 6. ポジション・タイプ・ひとこと
      S.drawText(ctx, ((ch && ch.position) || '') + '   タイプ：' + ((ch && typeNames[ch.type]) || '－'), VW / 2, 262, {
        size: 11, color: '#dff4ff', align: 'center',
      });
      S.drawText(ctx, '『 ' + (pf.flavor || '') + ' 』', VW / 2, 284, {
        size: 12, color: '#ffe89a', align: 'center',
      });

      // 7. 閉じる案内（演出が出そろってから）
      if (_t >= 0.5) {
        S.drawText(ctx, 'けってい/タップ で つづける', VW / 2, VH - 40, {
          size: 11, color: '#9fb6da', align: 'center',
        });
      }
    },

    isDone: function () { return _done; },
    _debug: function () { return { t: _t, done: _done, allyId: allyId }; },
  };
}

/**
 * createLiftingScene — リフティング ミニゲーム（機能③）
 *   まんなかで タイミングよく けってい/↑ を おすと リフティング成功。
 *   まん中に ちかいほど よい（perfect/good=せいこう、miss=しっぱい）。
 *   目標回数(TARGET)まで つづけたら 勝ち。ミスを LIVES 回 すると まけ。
 *   まわす はやさは 成功回数が ふえるほど はやくなる（S.liftingSpeed）。
 *   純粋判定は S.liftingJudge / S.liftingWin に委譲（描画・進行だけ ここが担当）。
 * @param {object} state - ゲーム状態（読み取りのみ・報酬付与は呼び出し側）
 * @param {{ onComplete?: function, target?: number, lives?: number, _fixedPos?: number }} [opts]
 * @returns {object} シーン（update/draw/isDone/_debug）
 */
function createLiftingScene(state, opts) {
  opts = opts || {};
  var S = (typeof window !== 'undefined' ? window : globalThis).SRPG;
  var VW = S.VW, VH = S.VH;
  var TARGET = opts.target || 15;
  var LIVES = opts.lives || 3;

  var _count = 0;       // 成功回数
  var _lives = LIVES;   // のこりミス回数
  var _marker = 0;      // タイミングバーの マーカー位置（0〜1）
  var _dir = 1;         // マーカーの いききする むき
  var _phase = 'play';  // 'play' | 'done'
  var _timer = 0;       // done の経過時間
  var _done = false;
  var _lastJudge = null;// 直近の 判定（perfect/good/miss）
  var _flash = 0;       // 判定表示の のこり時間

  function _pos() {
    return (opts._fixedPos != null) ? opts._fixedPos : _marker; // テスト用に位置を固定できる
  }

  function _tap() {
    var j = S.liftingJudge(_pos());
    _lastJudge = j;
    _flash = 0.45;
    if (j === 'miss') {
      _lives--;
      if (_lives <= 0) { _phase = 'done'; _timer = 0; }
    } else {
      _count++;
      if (_count >= TARGET) { _phase = 'done'; _timer = 0; }
    }
  }

  function _finish() {
    if (_done) return;
    _done = true;
    var win = S.liftingWin(_count, TARGET);
    S.popScene();
    if (typeof opts.onComplete === 'function') opts.onComplete(win, _count);
  }

  return {
    update: function (dt, input) {
      var pressed = (input && input.pressed) || {};
      if (_flash > 0) _flash = Math.max(0, _flash - dt);
      if (_phase === 'play') {
        // マーカーを いききさせる（成功回数で だんだん はやく＝むずかしく）
        var sp = S.liftingSpeed(_count);
        _marker += _dir * sp * dt;
        if (_marker >= 1) { _marker = 1; _dir = -1; }
        else if (_marker <= 0) { _marker = 0; _dir = 1; }
        if (pressed.confirm || pressed.up) { _tap(); return; }
        return;
      }
      if (_phase === 'done') {
        _timer += dt;
        if (_timer >= 0.4 && (pressed.confirm || pressed.cancel)) _finish();
        return;
      }
    },

    draw: function (ctx) {
      // 1. スタジアム背景（ひるまの あかるい しばふ）
      var bg = ctx.createLinearGradient(0, 0, 0, VH);
      bg.addColorStop(0,   '#8fd0ff');
      bg.addColorStop(0.5, '#bfe6ff');
      bg.addColorStop(1,   '#2f8f42');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, VW, VH);

      // 2. タイトル
      S.drawWindow(ctx, VW / 2 - 80, 14, 160, 28, { radius: 8, border: '#ffd34d' });
      S.drawText(ctx, 'リフティング！', VW / 2, 21, { size: 16, color: '#7a4a00', align: 'center' });

      // 3. せんしゅ＆ボール（マーカー位置で ボールの たかさが かわる）
      var cx = VW / 2;
      var groundY = 250;
      // 選手（かんたんな棒人間）
      ctx.fillStyle = '#3a63c8';
      ctx.fillRect(cx - 10, groundY - 34, 20, 34);       // 体
      ctx.fillStyle = '#ffd0b0';
      ctx.beginPath(); ctx.arc(cx, groundY - 44, 9, 0, Math.PI * 2); ctx.fill(); // 頭
      // ボール（marker 0=足もと / 1=たかく）
      var ballY = groundY - 20 - _marker * 120;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(cx, ballY, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, ballY, 11, 0, Math.PI * 2); ctx.stroke();

      // 4. タイミングバー（まんなかが perfect ゾーン）
      var barX = 34, barY = 300, barW = VW - 68, barH = 22;
      S.drawWindow(ctx, barX - 4, barY - 4, barW + 8, barH + 8, { radius: 6, border: '#5ec8ff' });
      // good ゾーン（うすい黄）
      ctx.fillStyle = 'rgba(255,211,77,0.35)';
      ctx.fillRect(barX + barW * 0.22, barY, barW * 0.56, barH);
      // perfect ゾーン（こい黄）
      ctx.fillStyle = 'rgba(255,180,0,0.6)';
      ctx.fillRect(barX + barW * 0.38, barY, barW * 0.24, barH);
      // マーカー
      var mx = barX + barW * _marker;
      ctx.fillStyle = '#ff3b3b';
      ctx.fillRect(mx - 3, barY - 6, 6, barH + 12);

      // 5. スコア
      S.drawWindow(ctx, VW / 2 - 90, barY + 40, 180, 30, { radius: 6, border: '#5ec8ff' });
      S.drawText(ctx, 'リフティング ' + _count + ' / ' + TARGET + '   ミス のこり ' + _lives,
                 VW / 2, barY + 48, { size: 12, color: '#3a2a00', align: 'center' });

      // 6. メッセージ窓
      var msgY = VH - 96;
      S.drawWindow(ctx, 12, msgY, VW - 24, 80, { radius: 8, border: '#ffd34d' });
      var line1, line2;
      if (_phase === 'play') {
        if (_flash > 0 && _lastJudge) {
          line1 = _lastJudge === 'perfect' ? 'ナイス！ パーフェクト！' : (_lastJudge === 'good' ? 'いいね！' : 'あっ…！');
        } else {
          line1 = 'まんなかで けってい/↑！';
        }
        line2 = 'まん中に ちかいほど よいよ';
      } else {
        var win = S.liftingWin(_count, TARGET);
        line1 = win ? ('かち！  ' + _count + ' かい！ すごい！') : ('まけ…  ' + _count + ' かい');
        line2 = 'けってい/キャンセル で とじる';
      }
      S.drawText(ctx, line1, VW / 2, msgY + 22, { size: 15, color: '#7a4a00', align: 'center' });
      S.drawText(ctx, line2, VW / 2, msgY + 50, { size: 11, color: '#5a4020', align: 'center' });
    },

    isDone: function () { return _done; },

    // テスト/検証用：内部状態を観測する。
    _debug: function () {
      return { phase: _phase, count: _count, lives: _lives, target: TARGET, win: S.liftingWin(_count, TARGET), marker: _marker };
    },
  };
}

/**
 * createShootScene — まとあて シュート ミニゲーム（機能③）
 *   3×3=9マスの ゴールで、ひかっている 的ゾーンに カーソルを あわせて けってい で シュート。
 *   ←→↑↓で カーソル移動、けっていで シュート。的と 同じマスなら ヒット（S.shootHit）。
 *   目標ヒット数(TARGET)に とどけば 勝ち。シュート回数(SHOTS)を つかいきったら おわり。
 *   的ゾーンは S.nextTargetZone で 毎回 うごく（純粋判定に委譲）。
 * @param {object} state - ゲーム状態（読み取りのみ・報酬付与は呼び出し側）
 * @param {{ onComplete?: function, target?: number, shots?: number }} [opts]
 * @returns {object} シーン（update/draw/isDone/_debug）
 */
function createShootScene(state, opts) {
  opts = opts || {};
  var S = (typeof window !== 'undefined' ? window : globalThis).SRPG;
  var VW = S.VW, VH = S.VH;
  var ZONES = 9;
  var TARGET = opts.target || 8;   // 目標ヒット数
  var SHOTS = opts.shots || 12;    // シュートできる回数

  var _cursor = 4;                              // カーソル位置（0〜8・まんなか始まり）
  var _zone = S.nextTargetZone(Math.random, null, ZONES); // ひかる 的ゾーン
  var _hits = 0;
  var _shot = 0;
  var _phase = 'aim';  // 'aim' | 'done'
  var _timer = 0;
  var _done = false;
  var _lastHit = null; // 直近の ヒット/はずれ
  var _flash = 0;

  function _move(dc, dr) {
    var col = _cursor % 3, row = Math.floor(_cursor / 3);
    col = Math.max(0, Math.min(2, col + dc));
    row = Math.max(0, Math.min(2, row + dr));
    _cursor = row * 3 + col;
  }

  function _shoot() {
    var hit = S.shootHit(_cursor, _zone);
    _lastHit = hit;
    _flash = 0.4;
    if (hit) _hits++;
    _shot++;
    if (S.shootWin(_hits, TARGET)) { _phase = 'done'; _timer = 0; }
    else if (_shot >= SHOTS) { _phase = 'done'; _timer = 0; }
    else { _zone = S.nextTargetZone(Math.random, _zone, ZONES); }
  }

  function _finish() {
    if (_done) return;
    _done = true;
    var win = S.shootWin(_hits, TARGET);
    S.popScene();
    if (typeof opts.onComplete === 'function') opts.onComplete(win, _hits);
  }

  return {
    update: function (dt, input) {
      var pressed = (input && input.pressed) || {};
      if (_flash > 0) _flash = Math.max(0, _flash - dt);
      if (_phase === 'aim') {
        if (pressed.left) { _move(-1, 0); return; }
        if (pressed.right) { _move(1, 0); return; }
        if (pressed.up) { _move(0, -1); return; }
        if (pressed.down) { _move(0, 1); return; }
        if (pressed.confirm) { _shoot(); return; }
        return;
      }
      if (_phase === 'done') {
        _timer += dt;
        if (_timer >= 0.4 && (pressed.confirm || pressed.cancel)) _finish();
        return;
      }
    },

    draw: function (ctx) {
      // 1. スタジアム背景
      var bg = ctx.createLinearGradient(0, 0, 0, VH);
      bg.addColorStop(0,   '#0b1733');
      bg.addColorStop(0.5, '#13245a');
      bg.addColorStop(1,   '#0a3d1f');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, VW, VH);

      // 2. タイトル
      S.drawWindow(ctx, VW / 2 - 80, 14, 160, 28, { radius: 8, border: '#ffd34d' });
      S.drawText(ctx, 'まとあて シュート！', VW / 2, 21, { size: 15, color: '#ffe9a8', align: 'center' });

      // 3. 3×3 ゴール（的ゾーンを ハイライト・カーソルを 枠で表示）
      var gx = 44, gy = 96, gw = VW - 88, gh = gw; // せいほうけい
      var cw = gw / 3, ch = gh / 3;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
      ctx.strokeRect(gx, gy, gw, gh);
      for (var z = 0; z < 9; z++) {
        var zc = z % 3, zr = Math.floor(z / 3);
        var zx = gx + zc * cw, zy = gy + zr * ch;
        // ゾーン区切り
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
        ctx.strokeRect(zx, zy, cw, ch);
        // 的ゾーン（ひかる）
        if (z === _zone) {
          ctx.fillStyle = 'rgba(255,211,77,0.55)';
          ctx.fillRect(zx + 2, zy + 2, cw - 4, ch - 4);
          // まと（同心円）
          var mcx = zx + cw / 2, mcy = zy + ch / 2;
          ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(mcx, mcy, Math.min(cw, ch) * 0.28, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(mcx, mcy, Math.min(cw, ch) * 0.13, 0, Math.PI * 2); ctx.stroke();
        }
        // カーソル
        if (z === _cursor) {
          ctx.strokeStyle = (_flash > 0 && _lastHit) ? '#7dff7d' : '#5ec8ff';
          ctx.lineWidth = 4;
          ctx.strokeRect(zx + 4, zy + 4, cw - 8, ch - 8);
        }
      }

      // 4. スコア
      S.drawWindow(ctx, VW / 2 - 100, gy + gh + 16, 200, 30, { radius: 6, border: '#5ec8ff' });
      S.drawText(ctx, 'ヒット ' + _hits + ' / ' + TARGET + '   のこり ' + Math.max(0, SHOTS - _shot) + 'ぼん',
                 VW / 2, gy + gh + 24, { size: 12, color: '#dff4ff', align: 'center' });

      // 5. メッセージ窓
      var msgY = VH - 96;
      S.drawWindow(ctx, 12, msgY, VW - 24, 80, { radius: 8, border: '#ffd34d' });
      var line1, line2;
      if (_phase === 'aim') {
        if (_flash > 0 && _lastHit !== null) {
          line1 = _lastHit ? 'ヒット！！' : 'はずれ…';
        } else {
          line1 = 'ひかる まとを ねらえ！';
        }
        line2 = '←→↑↓で いどう  けっていで シュート';
      } else {
        var win = S.shootWin(_hits, TARGET);
        line1 = win ? ('かち！  ' + _hits + ' ヒット！') : ('まけ…  ' + _hits + ' ヒット');
        line2 = 'けってい/キャンセル で とじる';
      }
      S.drawText(ctx, line1, VW / 2, msgY + 22, { size: 15, color: (_flash > 0 && _lastHit) ? '#ffe9a8' : '#dff4ff', align: 'center' });
      S.drawText(ctx, line2, VW / 2, msgY + 50, { size: 11, color: '#bcd6f0', align: 'center' });
    },

    isDone: function () { return _done; },

    // テスト/検証用：内部状態を観測する。
    _debug: function () {
      return { phase: _phase, cursor: _cursor, zone: _zone, hits: _hits, shot: _shot, shots: SHOTS, target: TARGET, zones: ZONES, win: S.shootWin(_hits, TARGET) };
    },
  };
}

// ── UMD エクスポート ──────────────────────────────────────────────────
(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  createFieldScene:   createFieldScene,
  lerp:               lerp,
  stepEase:           stepEase,
  minimapCell:        minimapCell,
  nearestExitLabel:   nearestExitLabel,
  fadeAlpha:          fadeAlpha,
  flashAlpha:         flashAlpha,
  createPkScene:      createPkScene,
  createLiftingScene: createLiftingScene,
  createShootScene:   createShootScene,
  createJoinCutinScene: createJoinCutinScene,
  frontTile:        frontTile,
  walkSideFlip:     walkSideFlip,
  npcMarkerKind:    npcMarkerKind,
  isWalkable:       isWalkable,
  clampCamera:      clampCamera,
  pendingCutscene:  pendingCutscene,
  npcPagesFor:      npcPagesFor,
  warpAt:           warpAt,
  conveyorAt:       conveyorAt,
  puzzleSolved:     puzzleSolved,
  tryPushBlock:     tryPushBlock,
  _withActiveNpcs:  _withActiveNpcs,
  _ambientFor:      _ambientFor,
  _toneFor:         _toneFor,
  _isProcTile:      _isProcTile,
  _procBaseSprite:  _procBaseSprite,
  _waterEdgeMask:   _waterEdgeMask,
  _neighborMask:    _neighborMask,
  _isBaseTile:      _isBaseTile,
  _isWaterSprite:   _isWaterSprite,
});
