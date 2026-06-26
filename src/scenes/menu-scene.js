// === menu-scene.js ===
// フィールドの cancel（✕）で開くメニュー（半透明オーバーレイ）。
// つよさ / どうぐ / そうび / さくせん / セーブ / とじる。
//
// ⚠️ バンドルスコープの鉄則：単一 index.html では全 src が 1 スコープを共有するため
//    トップレベルの const/let は同名衝突で構文エラー（黒画面）になる。
//    → このファイルはトップレベルを「関数宣言のみ」にし、ヘルパは全て createMenuScene
//      内のクロージャ、データ(ITEMS/SKILLS)は S(window.SRPG) から遅延参照する。

function createMenuScene(state) {
  var S = (typeof window !== 'undefined') ? window.SRPG : null;
  var VW = (S && S.VW) || 288;
  var VH = (S && S.VH) || 512;

  // ── データ遅延参照（同名 const を作らない） ──
  function ITEMS()  { return (S && S.ITEMS)  || {}; }
  function SKILLS() { return (S && S.SKILLS) || {}; }

  // ── 状態 ──
  var mode      = 'main';   // main/status/items/item_target/equip_char/equip_slot/equip_pick/tactics/message
  var cursor    = 0;
  var statusIdx = 0;        // つよさ表示中のキャラ index
  var pendingItem = null;   // どうぐ：使用予定アイテム id
  var pendingChar = null;   // そうび：対象キャラ
  var pendingSlot = null;   // そうび：'weapon' | 'armor'
  var listCache = [];       // 現在のリスト [{label,v}]
  var _msg = null, _afterMode = 'main';

  // ── 小ヘルパ ──
  function party()  { return state.party || []; }
  function inv()    { return state.inventory || (state.inventory = {}); }
  function isDead(u){ return !u || u.dead === true || u.hp <= 0; }

  // ── メッセージ（dialogState を流用してタイプライター表示） ──
  function showMsg(pages, after) {
    pages = (pages || []).filter(function (p) { return p != null && p !== ''; });
    _afterMode = after || 'main';
    if (S && S.createDialogState && pages.length) {
      _msg = S.createDialogState(pages);
      mode = 'message';
    } else {
      enter(_afterMode);
    }
  }

  // ── リスト構築 ──
  function buildMain() {
    listCache = [
      { label: 'つよさ',   v: 'status'  },
      { label: 'どうぐ',   v: 'items'   },
      { label: 'そうび',   v: 'equip'   },
      { label: 'さくせん', v: 'tactics' },
      { label: 'セーブ',   v: 'save'    },
      { label: 'とじる',   v: 'close'   },
    ];
  }
  function buildItems() {
    var I = ITEMS(); var list = [];
    Object.keys(inv()).forEach(function (id) {
      var it = I[id]; var c = inv()[id];
      if (it && it.kind === 'item' && c > 0) list.push({ label: it.name + ' x' + c, v: id });
    });
    if (!list.length) list.push({ label: '（どうぐは ない）', v: '__none' });
    list.push({ label: 'もどる', v: '__back' });
    listCache = list;
  }
  function buildItemTarget() {
    var I = ITEMS(); var it = I[pendingItem] || {};
    var revive = !!(it.effect && ('revive' in it.effect));
    var list = party()
      .filter(function (p) { return revive ? true : !isDead(p); })
      .map(function (p) {
        return { label: p.name + (isDead(p) ? '（ダウン）' : ' HP' + p.hp + '/' + p.maxHp), v: p.id };
      });
    list.push({ label: 'もどる', v: '__back' });
    listCache = list;
  }
  function buildEquipChar() {
    listCache = party().map(function (p) { return { label: p.name, v: p.id }; });
    listCache.push({ label: 'もどる', v: '__back' });
  }
  function buildEquipSlot() {
    var I = ITEMS();
    var w = pendingChar && pendingChar.equip && pendingChar.equip.weapon;
    var a = pendingChar && pendingChar.equip && pendingChar.equip.armor;
    listCache = [
      { label: 'ぶき：'  + (w && I[w] ? I[w].name : 'なし'), v: 'weapon' },
      { label: 'ぼうぐ：' + (a && I[a] ? I[a].name : 'なし'), v: 'armor'  },
      { label: 'もどる', v: '__back' },
    ];
  }
  function buildEquipPick() {
    var I = ITEMS(); var kind = (pendingSlot === 'weapon') ? 'weapon' : 'armor';
    var list = [];
    Object.keys(inv()).forEach(function (id) {
      var it = I[id]; var c = inv()[id];
      if (it && it.kind === kind && c > 0) {
        var stat = (kind === 'weapon') ? ('こうげき+' + it.atk) : ('まもり+' + it.def);
        list.push({ label: it.name + '(' + stat + ') x' + c, v: id });
      }
    });
    if (pendingChar && pendingChar.equip && pendingChar.equip[pendingSlot]) {
      list.push({ label: 'はずす', v: '__unequip' });
    }
    if (!list.length || (list.length === 1 && list[0].v === '__unequip')) {
      list.unshift({ label: '（もちものが ない）', v: '__none' });
    }
    list.push({ label: 'もどる', v: '__back' });
    listCache = list;
  }
  function buildTactics() {
    var on = !(state.settings && state.settings.autoAllies === false);
    listCache = [
      { label: (on  ? '▸ ' : '  ') + 'おまかせ：自動でたたかう', v: 'auto'   },
      { label: (!on ? '▸ ' : '  ') + 'まもり：みをまもる',       v: 'manual' },
      { label: 'もどる', v: '__back' },
    ];
  }

  // ── 操作（装備・道具使用） ──
  function equipItem(id) {
    var slot = pendingSlot;
    var cur = pendingChar.equip[slot];
    if (cur) inv()[cur] = (inv()[cur] || 0) + 1;     // 外した装備をもちものへ戻す
    pendingChar.equip[slot] = id;
    inv()[id] = (inv()[id] || 1) - 1;
    if (inv()[id] <= 0) delete inv()[id];
    if (S && S.saveGame) S.saveGame(state);
  }
  function unequip() {
    var slot = pendingSlot; var cur = pendingChar.equip[slot];
    if (cur) {
      inv()[cur] = (inv()[cur] || 0) + 1;
      pendingChar.equip[slot] = null;
      if (S && S.saveGame) S.saveGame(state);
    }
  }
  function useItemOnTarget(targetId) {
    var I = ITEMS(); var it = I[pendingItem];
    var t = party().find(function (p) { return p.id === targetId; });
    if (!it || !t) { showMsg(['つかえなかった'], 'items'); return; }
    var r = { ok: true, message: '' };
    if (S && S.useItem) r = S.useItem(t, it);
    if (r.ok) {
      inv()[pendingItem] = (inv()[pendingItem] || 1) - 1;
      if (inv()[pendingItem] <= 0) delete inv()[pendingItem];
      if (S && S.saveGame) S.saveGame(state);
    }
    showMsg([t.name + 'に ' + it.name + 'を つかった！\n' + (r.message || '')], 'items');
  }

  // ── モード遷移（リストを構築してカーソルを戻す） ──
  function enter(m) {
    mode = m; cursor = 0;
    if      (m === 'main')        buildMain();
    else if (m === 'items')       buildItems();
    else if (m === 'item_target') buildItemTarget();
    else if (m === 'equip_char')  buildEquipChar();
    else if (m === 'equip_slot')  buildEquipSlot();
    else if (m === 'equip_pick')  buildEquipPick();
    else if (m === 'tactics')     buildTactics();
    else if (m === 'status')      { /* statusIdx は呼び出し側で設定 */ }
  }

  function onCancel() {
    switch (mode) {
      case 'main':        if (S && S.popScene) S.popScene(); break;
      case 'status':      enter('main');        break;
      case 'items':       enter('main');        break;
      case 'item_target': enter('items');       break;
      case 'equip_char':  enter('main');        break;
      case 'equip_slot':  enter('equip_char');  break;
      case 'equip_pick':  enter('equip_slot');  break;
      case 'tactics':     enter('main');        break;
    }
  }

  function onConfirm(item) {
    if (!item) return;
    if (mode === 'main') {
      switch (item.v) {
        case 'status':  statusIdx = 0; mode = 'status'; cursor = 0; break;
        case 'items':   enter('items');   break;
        case 'equip':   enter('equip_char'); break;
        case 'tactics': enter('tactics'); break;
        case 'save':    if (S && S.saveGame) S.saveGame(state); showMsg(['ぼうけんを きろくした！'], 'main'); break;
        case 'close':   if (S && S.popScene) S.popScene(); break;
      }
      return;
    }
    if (mode === 'items') {
      if (item.v === '__back' || item.v === '__none') { enter('main'); return; }
      pendingItem = item.v; enter('item_target'); return;
    }
    if (mode === 'item_target') {
      if (item.v === '__back') { enter('items'); return; }
      useItemOnTarget(item.v); return;
    }
    if (mode === 'equip_char') {
      if (item.v === '__back') { enter('main'); return; }
      pendingChar = party().find(function (p) { return p.id === item.v; });
      enter('equip_slot'); return;
    }
    if (mode === 'equip_slot') {
      if (item.v === '__back') { enter('equip_char'); return; }
      pendingSlot = item.v; enter('equip_pick'); return;
    }
    if (mode === 'equip_pick') {
      if (item.v === '__back' || item.v === '__none') { enter('equip_slot'); return; }
      if (item.v === '__unequip') { unequip(); enter('equip_slot'); return; }
      equipItem(item.v); enter('equip_slot'); return;
    }
    if (mode === 'tactics') {
      if (item.v === '__back') { enter('main'); return; }
      if (!state.settings) state.settings = {};
      state.settings.autoAllies = (item.v === 'auto');
      if (S && S.saveGame) S.saveGame(state);
      buildTactics(); return; // ▸ マーカーを更新して留まる
    }
  }

  // ── 描画 ──
  function drawMainPanel(ctx) {
    // コマンド窓（左）
    S.drawWindow(ctx, 12, 24, 116, 196, { radius: 10, border: '#5ec8ff' });
    S.drawText(ctx, 'メニュー', 70, 32, { size: 13, color: '#ffd76e', align: 'center' });
    for (var i = 0; i < listCache.length; i++) {
      var y = 56 + i * 26;
      if (i === cursor) S.drawText(ctx, '▶', 24, y, { size: 13, color: '#ffd76e' });
      S.drawText(ctx, listCache[i].label, 42, y, { size: 14, color: i === cursor ? '#ffffff' : '#cfe0ff' });
    }
    // 情報窓（右）：ゴールド＋パーティ
    S.drawWindow(ctx, 136, 24, 140, 196, { radius: 10, border: '#3a5a8a' });
    S.drawText(ctx, 'ゴールド ' + (state.gold || 0) + 'G', 146, 32, { size: 12, color: '#ffd76e' });
    var p = party();
    for (var j = 0; j < p.length; j++) {
      var m = p[j]; var yy = 54 + j * 30;
      S.drawText(ctx, m.name + ' Lv' + m.level, 146, yy, { size: 11, color: isDead(m) ? '#8090b0' : '#ffffff' });
      S.drawText(ctx, 'HP ' + m.hp + '/' + m.maxHp + '  MP ' + m.mp + '/' + m.maxMp, 146, yy + 13, { size: 9, color: '#a8c0e0' });
    }
  }

  function listTitle() {
    switch (mode) {
      case 'items':       return 'どうぐ';
      case 'item_target': return 'だれに つかう？';
      case 'equip_char':  return 'そうび：だれの？';
      case 'equip_slot':  return (pendingChar ? pendingChar.name : '') + 'の そうび';
      case 'equip_pick':  return (pendingSlot === 'weapon') ? 'ぶきを えらぶ' : 'ぼうぐを えらぶ';
      case 'tactics':     return 'さくせん';
      default:            return '';
    }
  }

  function drawListPanel(ctx) {
    var X = 20, Y = 28, W = VW - 40, H = 300;
    S.drawWindow(ctx, X, Y, W, H, { radius: 10, border: '#5ec8ff' });
    S.drawText(ctx, listTitle(), X + W / 2, Y + 10, { size: 14, color: '#ffd76e', align: 'center' });
    var top = Y + 38, rowH = 24;
    for (var i = 0; i < listCache.length; i++) {
      var y = top + i * rowH;
      if (y > Y + H - 18) break;
      if (i === cursor) S.drawText(ctx, '▶', X + 12, y, { size: 13, color: '#ffd76e' });
      S.drawText(ctx, listCache[i].label, X + 32, y, { size: 13, color: i === cursor ? '#ffffff' : '#cfe0ff' });
    }
  }

  function drawStatusPanel(ctx) {
    var m = party()[statusIdx]; if (!m) return;
    var X = 16, Y = 24, W = VW - 32, H = 320;
    S.drawWindow(ctx, X, Y, W, H, { radius: 10, border: '#5ec8ff' });
    if (S.SPRITES && S.SPRITES[m.id]) S.drawSprite(ctx, S.SPRITES[m.id], X + 16, Y + 14, 2);
    S.drawText(ctx, m.name, X + 92, Y + 20, { size: 18, color: '#ffffff' });
    S.drawText(ctx, m.position || '', X + 92, Y + 44, { size: 11, color: '#a8c0e0' });
    S.drawText(ctx, 'Lv ' + m.level, X + 92, Y + 60, { size: 14, color: '#ffd76e' });

    var eff = (S.applyEquip) ? S.applyEquip(m) : { atk: m.atk, def: m.def };
    var I = ITEMS(); var Sk = SKILLS();
    var nextNeed = (S.expForNextLevel ? S.expForNextLevel(m.level) : 0) - (m.exp || 0);
    var rows = [
      ['HP', m.hp + ' / ' + m.maxHp],
      ['MP', m.mp + ' / ' + m.maxMp],
      ['こうげき', '' + eff.atk],
      ['まもり', '' + eff.def],
      ['すばやさ', '' + m.spd],
      ['つぎのLvまで', nextNeed > 0 ? ('' + nextNeed) : '—'],
    ];
    var by = Y + 92;
    for (var i = 0; i < rows.length; i++) {
      var yy = by + i * 24;
      S.drawText(ctx, rows[i][0], X + 20, yy, { size: 13, color: '#a8c0e0' });
      S.drawText(ctx, rows[i][1], X + W - 20, yy, { size: 14, color: '#ffffff', align: 'right' });
    }
    var wy = by + rows.length * 24 + 6;
    var w = m.equip && m.equip.weapon, a = m.equip && m.equip.armor;
    S.drawText(ctx, 'ぶき：'  + (w && I[w] ? I[w].name : 'なし'), X + 20, wy,      { size: 12, color: '#dff4ff' });
    S.drawText(ctx, 'ぼうぐ：' + (a && I[a] ? I[a].name : 'なし'), X + 20, wy + 18, { size: 12, color: '#dff4ff' });
    var skNames = (m.skills || []).map(function (id) { return Sk[id] ? Sk[id].name : id; }).join('・');
    S.drawText(ctx, 'とくぎ：' + (skNames || 'なし'), X + 20, wy + 40, { size: 11, color: '#cfe0ff' });
    S.drawText(ctx, '◀ ▶ きりかえ / ✕ もどる', X + W / 2, Y + H - 20, { size: 10, color: '#88a0c0', align: 'center' });
  }

  function drawMessage(ctx) {
    if (!_msg) return;
    var X = 16, Y = 130, W = VW - 32, H = 100;
    S.drawWindow(ctx, X, Y, W, H, { radius: 10, border: '#5ec8ff' });
    var vis = _msg.getVisibleText ? _msg.getVisibleText() : '';
    var lines = (S.wrapText ? S.wrapText(vis, 17) : [vis]);
    for (var i = 0; i < lines.length; i++) {
      S.drawText(ctx, lines[i], X + 12, Y + 14 + i * 20, { size: 14, color: '#dff4ff' });
    }
  }

  // ── 初期化 ──
  enter('main');

  return {
    transparent: true,

    update: function (dt, input) {
      if (!S) return;
      var pressed = (input && input.pressed) || {};

      if (mode === 'message') {
        if (_msg) {
          var r = _msg.update(dt, !!pressed.confirm);
          if (r && r.done) { _msg = null; enter(_afterMode); }
        }
        return;
      }
      if (mode === 'status') {
        if (pressed.cancel) { onCancel(); return; }
        var pn = party().length || 1;
        if (pressed.left)  statusIdx = (statusIdx - 1 + pn) % pn;
        if (pressed.right) statusIdx = (statusIdx + 1) % pn;
        return;
      }

      // リスト系モード
      var n = listCache.length || 1;
      if (pressed.up)      cursor = (cursor - 1 + n) % n;
      if (pressed.down)    cursor = (cursor + 1) % n;
      if (pressed.cancel)  { onCancel(); return; }
      if (pressed.confirm) { onConfirm(listCache[cursor]); return; }
    },

    draw: function (ctx) {
      if (!S) return;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, VW, VH);
      if      (mode === 'main')    drawMainPanel(ctx);
      else if (mode === 'status')  drawStatusPanel(ctx);
      else if (mode === 'message') drawMessage(ctx);
      else                         drawListPanel(ctx);
    },
  };
}

// ── UMD エクスポート ──────────────────────────────────────────────────
(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  createMenuScene: createMenuScene,
});
