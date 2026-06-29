// === shop-scene.js ===
// 道具屋・装備屋（半透明オーバーレイ）。かう / うる / でる。
// shopDef = { type:'item'|'equip', name:'どうぐ屋', items:[itemId...], greeting?:'...' }
//
// ⚠️ バンドルスコープの鉄則：トップレベルは関数宣言のみ。データ(ITEMS)は遅延参照。

function createShopScene(state, shopDef) {
  var S = (typeof window !== 'undefined') ? window.SRPG : null;
  var VW = (S && S.VW) || 288;
  var VH = (S && S.VH) || 512;
  shopDef = shopDef || {};

  // 宿屋モード：かう/うる の代わりに「とまる」で全回復する。
  var isInn   = shopDef.type === 'inn';
  var innCost = (typeof shopDef.cost === 'number') ? shopDef.cost : 20;

  function ITEMS() { return (S && S.ITEMS) || {}; }
  function inv()   { return state.inventory || (state.inventory = {}); }

  var mode = 'menu';      // menu/buy/sell/message
  var cursor = 0;
  var listCache = [];
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

  function buildMenu() {
    if (isInn) {
      listCache = [
        { label: 'とまる  ' + innCost + 'G', v: 'stay' },
        { label: 'でる',                    v: 'exit' },
      ];
      return;
    }
    listCache = [
      { label: 'かう', v: 'buy'  },
      { label: 'うる', v: 'sell' },
      { label: 'でる', v: 'exit' },
    ];
  }
  function buildBuy() {
    var I = ITEMS(); var list = [];
    (shopDef.items || []).forEach(function (id) {
      var it = I[id];
      if (it) list.push({ label: it.name + '  ' + it.price + 'G', v: id });
    });
    if (!list.length) list.push({ label: '（うってない）', v: '__none' });
    list.push({ label: 'もどる', v: '__back' });
    listCache = list;
  }
  function buildSell() {
    var I = ITEMS(); var list = [];
    Object.keys(inv()).forEach(function (id) {
      var it = I[id]; var c = inv()[id];
      if (it && it.price && c > 0) {
        list.push({ label: it.name + ' x' + c + '  ' + Math.floor(it.price / 2) + 'G', v: id });
      }
    });
    if (!list.length) list.push({ label: '（うれる ものが ない）', v: '__none' });
    list.push({ label: 'もどる', v: '__back' });
    listCache = list;
  }

  function enter(m) {
    mode = m; cursor = 0;
    if      (m === 'menu') buildMenu();
    else if (m === 'buy')  buildBuy();
    else if (m === 'sell') buildSell();
  }

  function onCancel() {
    if (mode === 'menu') { if (S && S.popScene) S.popScene(); }
    else if (mode === 'buy' || mode === 'sell') enter('menu');
  }

  function onConfirm(item) {
    if (!item) return;
    if (mode === 'menu') {
      if (item.v === 'buy')  enter('buy');
      else if (item.v === 'sell') enter('sell');
      else if (item.v === 'stay') {
        // 宿屋：ゴールドを払って全員 HP/MP 全回復＋復活。
        if ((state.gold || 0) >= innCost) {
          state.gold = (state.gold || 0) - innCost;
          if (S && typeof S.healParty === 'function') S.healParty(state.party);
          if (S && S.saveGame) S.saveGame(state);
          showMsg(['ぐっすり ねむった……', 'みんな げんきに なった！'], 'menu');
        } else {
          showMsg(['ゴールドが たりないよ！'], 'menu');
        }
      }
      else if (item.v === 'exit') { if (S && S.popScene) S.popScene(); }
      return;
    }
    if (mode === 'buy') {
      if (item.v === '__back' || item.v === '__none') { enter('menu'); return; }
      var I = ITEMS(); var it = I[item.v];
      if (!it) return;
      if ((state.gold || 0) >= it.price) {
        state.gold = (state.gold || 0) - it.price;
        inv()[item.v] = (inv()[item.v] || 0) + 1;
        if (S && S.saveGame) S.saveGame(state);
        showMsg([it.name + 'を かった！'], 'buy');
      } else {
        showMsg(['ゴールドが たりないよ！'], 'buy');
      }
      return;
    }
    if (mode === 'sell') {
      if (item.v === '__back' || item.v === '__none') { enter('menu'); return; }
      var I2 = ITEMS(); var it2 = I2[item.v];
      if (!it2) return;
      var price = Math.floor((it2.price || 0) / 2);
      state.gold = (state.gold || 0) + price;
      inv()[item.v] = (inv()[item.v] || 1) - 1;
      if (inv()[item.v] <= 0) delete inv()[item.v];
      if (S && S.saveGame) S.saveGame(state);
      showMsg([it2.name + 'を うった！\n' + price + 'ゴールド てにいれた！'], 'sell');
      return;
    }
  }

  function drawFrame(ctx) {
    var X = 18, Y = 26, W = VW - 36, H = 300;
    S.drawWindow(ctx, X, Y, W, H, { radius: 10, border: '#ffd76e' });
    S.drawText(ctx, shopDef.name || 'みせ', X + W / 2, Y + 8, { size: 15, color: '#ffd76e', align: 'center' });
    S.drawText(ctx, 'しょじ ' + (state.gold || 0) + 'G', X + W / 2, Y + 28, { size: 12, color: '#ffffff', align: 'center' });
    return { X: X, Y: Y, W: W, H: H };
  }
  function drawList(ctx, f) {
    var top = f.Y + 50, rowH = 24;
    for (var i = 0; i < listCache.length; i++) {
      var y = top + i * rowH;
      if (y > f.Y + f.H - 50) break;  // 下部はアイテム説明フッター用に空ける。
      if (i === cursor) S.drawText(ctx, '▶', f.X + 14, y, { size: 13, color: '#ffd76e' });
      S.drawText(ctx, listCache[i].label, f.X + 34, y, { size: 13, color: i === cursor ? '#ffffff' : '#cfe0ff' });
    }
    // 選択中アイテムの説明（v がアイテムidの時だけ＝かう・うる）。
    var cur = listCache[cursor];
    var det = cur && cur.v ? ITEMS()[cur.v] : null;
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

  // ── 初期化（あいさつがあれば最初に表示） ──
  buildMenu();
  if (shopDef.greeting) showMsg([shopDef.greeting], 'menu');

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
      if (pressed.up)      cursor = (cursor - 1 + n) % n;
      if (pressed.down)    cursor = (cursor + 1) % n;
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
  createShopScene: createShopScene,
});
