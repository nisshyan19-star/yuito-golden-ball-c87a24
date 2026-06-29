// === forge-scene.js ===
// 鍛冶屋（追加弾5-D）。そざい＋ゴールドで そうびを ごうせいする。
// shop-scene.js を おてほんに モード切替・カーソル・描画を踏襲する。
// forgeDef = { name?:'かじや' }
//
// ⚠️ バンドルスコープの鉄則：トップレベルは関数宣言のみ。データ(ITEMS/レシピ)は遅延参照。

function createForgeScene(state, forgeDef) {
  var S = (typeof window !== 'undefined') ? window.SRPG : null;
  var VW = (S && S.VW) || 288;
  var VH = (S && S.VH) || 512;
  forgeDef = forgeDef || {};

  function ITEMS()   { return (S && S.ITEMS) || {}; }
  function inv()     { return state.inventory || (state.inventory = {}); }
  function recipes() { return (S && S.forgeRecipes) ? S.forgeRecipes() : []; }
  function nameOf(id) { var it = ITEMS()[id]; return (it && it.name) || id; }

  var mode = 'menu';      // menu/detail/message
  var cursor = 0;
  var listCache = [];
  var selRecipe = null;   // detail 中のレシピ
  var _msg = null, _after = 'menu';

  function showMsg(pages, after) {
    pages = (pages || []).filter(function (p) { return p != null && p !== ''; });
    _after = after || 'menu';
    if (S && S.createDialogState && pages.length) {
      _msg = S.createDialogState(pages);
      mode = 'message';
    } else {
      enter(_after);
    }
  }

  // レシピが いま つくれるか（true=作れる）。
  function canMake(recipeId) {
    if (!(S && S.canForge)) return false;
    return !!S.canForge(state, recipeId).ok;
  }

  function buildMenu() {
    var list = [];
    recipes().forEach(function (r) {
      var mark = canMake(r.id) ? '  ✓' : '  …';
      list.push({ label: nameOf(r.result) + mark, v: r.id });
    });
    if (!list.length) list.push({ label: '（レシピが ない）', v: '__none' });
    list.push({ label: 'でる', v: '__exit' });
    listCache = list;
  }

  // detail：選んだレシピの必要素材・ゴールドを 所持数つきで一覧。
  function buildDetail() {
    var list = [];
    if (selRecipe) {
      (selRecipe.materials || []).forEach(function (m) {
        var have = inv()[m.id] || 0;
        var ok = have >= m.qty;
        list.push({ label: nameOf(m.id) + '  ' + have + '/' + m.qty, v: '__mat', ok: ok });
      });
      list.push({ label: 'ゴールド  ' + (state.gold || 0) + '/' + (selRecipe.gold || 0), v: '__mat', ok: (state.gold || 0) >= (selRecipe.gold || 0) });
    }
    list.push({ label: 'つくる', v: '__make' });
    list.push({ label: 'もどる', v: '__back' });
    listCache = list;
  }

  function enter(m) {
    mode = m; cursor = 0;
    if      (m === 'menu')   buildMenu();
    else if (m === 'detail') {
      buildDetail();
      // 「つくる」に カーソルを合わせておく（素材行は選べない情報行）。
      for (var i = 0; i < listCache.length; i++) {
        if (listCache[i].v === '__make') { cursor = i; break; }
      }
    }
  }

  function onCancel() {
    if (mode === 'menu') { if (S && S.popScene) S.popScene(); }
    else if (mode === 'detail') enter('menu');
  }

  function onConfirm(item) {
    if (!item) return;
    if (mode === 'menu') {
      if (item.v === '__exit' || item.v === '__none') { if (S && S.popScene) S.popScene(); return; }
      // レシピを選んで detail へ
      var rs = recipes();
      for (var i = 0; i < rs.length; i++) {
        if (rs[i].id === item.v) { selRecipe = rs[i]; break; }
      }
      enter('detail');
      return;
    }
    if (mode === 'detail') {
      if (item.v === '__back') { enter('menu'); return; }
      if (item.v === '__mat')  { return; } // 情報行：何もしない
      if (item.v === '__make') {
        if (!selRecipe) { enter('menu'); return; }
        var res = (S && S.doForge) ? S.doForge(state, selRecipe.id) : { ok: false };
        if (res.ok) {
          if (S && S.saveGame) S.saveGame(state);
          showMsg([nameOf(res.result) + 'を つくった！'], 'menu');
        } else if (res.reason === 'gold') {
          showMsg(['ゴールドが たりないよ！'], 'detail');
        } else {
          showMsg(['そざいが たりないよ！'], 'detail');
        }
        return;
      }
    }
  }

  function drawFrame(ctx) {
    var X = 18, Y = 26, W = VW - 36, H = 300;
    S.drawWindow(ctx, X, Y, W, H, { radius: 10, border: '#ffd76e' });
    S.drawText(ctx, forgeDef.name || 'かじや', X + W / 2, Y + 8, { size: 15, color: '#ffd76e', align: 'center' });
    S.drawText(ctx, 'しょじ ' + (state.gold || 0) + 'G', X + W / 2, Y + 28, { size: 12, color: '#ffffff', align: 'center' });
    if (mode === 'detail' && selRecipe) {
      S.drawText(ctx, '→ ' + nameOf(selRecipe.result), X + W / 2, Y + 44, { size: 12, color: '#9fe6ff', align: 'center' });
    }
    return { X: X, Y: Y, W: W, H: H };
  }

  // カーソル行（menu）または選択中レシピ（detail）の できあがり装備を返す。
  function resultItemForDesc() {
    if (mode === 'detail' && selRecipe) return ITEMS()[selRecipe.result] || null;
    var cur = listCache[cursor];
    if (!cur || !cur.v) return null;
    var rs = recipes();
    for (var k = 0; k < rs.length; k++) {
      if (rs[k].id === cur.v) return ITEMS()[rs[k].result] || null;
    }
    return null;
  }

  function drawList(ctx, f) {
    var top = f.Y + (mode === 'detail' ? 64 : 50), rowH = 24;
    for (var i = 0; i < listCache.length; i++) {
      var y = top + i * rowH;
      if (y > f.Y + f.H - 50) break;  // 下部はできあがり装備の説明フッター用に空ける。
      var row = listCache[i];
      // 足りない素材行は あかく、十分なら みどり。それ以外は通常色。
      var col;
      if (row.v === '__mat') col = row.ok ? '#9be8a0' : '#ff9aa0';
      else col = (i === cursor) ? '#ffffff' : '#cfe0ff';
      if (i === cursor && row.v !== '__mat') S.drawText(ctx, '▶', f.X + 14, y, { size: 13, color: '#ffd76e' });
      S.drawText(ctx, row.label, f.X + 34, y, { size: 13, color: col });
    }
    // できあがる装備の説明。
    var det = resultItemForDesc();
    if (det && det.desc) {
      var dy = f.Y + f.H - 42;
      var dl = (S.wrapText ? S.wrapText(det.desc, 20) : [det.desc]);
      for (var d = 0; d < Math.min(2, dl.length); d++) {
        S.drawText(ctx, dl[d], f.X + 16, dy + d * 16, { size: 11, color: '#bfe6c8' });
      }
    }
  }

  function drawMessage(ctx) {
    if (!_msg) return;
    var X = 16, Y = 150, W = VW - 32, H = 96;
    S.drawWindow(ctx, X, Y, W, H, { radius: 10, border: '#5ec8ff' });
    var vis = _msg.getVisibleText ? _msg.getVisibleText() : '';
    var lines = (S.wrapText ? S.wrapText(vis, 17) : [vis]);
    for (var i = 0; i < lines.length; i++) {
      S.drawText(ctx, lines[i], X + 12, Y + 14 + i * 20, { size: 14, color: '#dff4ff' });
    }
  }

  // ── 初期化 ──
  buildMenu();
  if (forgeDef.greeting) showMsg([forgeDef.greeting], 'menu');

  return {
    transparent: true,

    update: function (dt, input) {
      if (!S) return;
      var pressed = (input && input.pressed) || {};
      if (mode === 'message') {
        if (_msg) {
          var r = _msg.update(dt, !!pressed.confirm);
          if (r && r.done) { _msg = null; enter(_after); }
        }
        return;
      }
      var n = listCache.length || 1;
      // 情報行（__mat）はスキップして カーソルを 選べる行だけに とめる。
      function step(dir) {
        var c = cursor;
        for (var g = 0; g < n; g++) {
          c = (c + dir + n) % n;
          if (listCache[c] && listCache[c].v !== '__mat') return c;
        }
        return cursor;
      }
      if (pressed.up)      cursor = step(-1);
      if (pressed.down)    cursor = step(1);
      if (pressed.cancel)  { onCancel(); return; }
      if (pressed.confirm) { onConfirm(listCache[cursor]); return; }
    },

    draw: function (ctx) {
      if (!S) return;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, VW, VH);
      var f = drawFrame(ctx);
      if (mode === 'message') { drawMessage(ctx); return; }
      drawList(ctx, f);
    },
  };
}

// ── UMD エクスポート ──────────────────────────────────────────────────
(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  createForgeScene: createForgeScene,
});
