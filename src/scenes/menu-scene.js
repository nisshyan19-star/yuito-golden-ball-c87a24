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
  function ITEMS()   { return (S && S.ITEMS)   || {}; }
  function SKILLS()  { return (S && S.SKILLS)  || {}; }
  function ENEMIES() { return (S && S.ENEMIES) || {}; }
  function ACHIEVEMENTS() { return (S && S.ACHIEVEMENTS) || []; }
  function TITLES()       { return (S && S.TITLES)       || []; }
  function unlockedTitles() { return (S && S.unlockedTitles) ? S.unlockedTitles(state) : []; }
  // なかま入替 API（monster.js）の遅延参照。require / window.SRPG どちらでも引ける。
  function _monster() {
    if (typeof require !== 'undefined') { try { return require('../logic/monster.js'); } catch (e) {} }
    return (typeof window !== 'undefined' && window.SRPG) || {};
  }
  function maxPartyN() { var M = _monster(); return (M && M.maxParty) ? M.maxParty() : 5; }
  function roster()    { return state.roster || (state.roster = []); }
  function typeLabel(t) {
    return t === 'power' ? 'パワー'
         : t === 'speed' ? 'スピード'
         : t === 'technique' ? 'テクニック' : '—';
  }

  // ── 状態 ──
  var mode      = 'main';   // main/status/dex/items/item_target/equip_char/equip_slot/equip_pick/tactics/message
  var cursor    = 0;
  var statusIdx = 0;        // つよさ表示中のキャラ index
  var dexIdx    = 0;        // ずかん表示中の 敵 index
  var achIdx    = 0;        // じっせき表示中のスクロール位置（先頭行 index）
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
      { label: 'なかま',   v: 'party'   },
      { label: 'はなす',   v: 'talk'    },
      { label: 'どうぐ',   v: 'items'   },
      { label: 'そうび',   v: 'equip'   },
      { label: 'ずかん',   v: 'dex'     },
      { label: 'じっせき', v: 'ach'     },
      { label: 'しょうごう', v: 'title' },
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
  // しょうごう：手に入れた称号を 1つだけ そうびできる（drawTitlePanel が描画）。
  function buildTitle() {
    var list = [];
    unlockedTitles().forEach(function (t) {
      list.push({ label: t.name, v: t.id, bonus: t.bonus, desc: t.desc, equipped: state.title === t.id });
    });
    list.push({ label: 'しょうごうなし', v: '__unequip', none: true, equipped: !state.title });
    list.push({ label: 'もどる', v: '__back', back: true });
    listCache = list;
  }
  // なかま：パーティと控え(roster)を1つの選択リストに連結する。
  //   kind:'party'  … 決定でひかえへ戻す（slot0=リーダーは不可）
  //   kind:'roster' … 決定でパーティへ入れる（満員なら拒否）
  function buildParty() {
    var list = [];
    var p = party();
    var max = maxPartyN();
    list.push({ header: 'パーティ（' + p.length + '/' + max + '）', v: '__hdr_party' });
    for (var i = 0; i < p.length; i++) {
      var m = p[i];
      list.push({ kind: 'party', pIdx: i, leader: i === 0, label: m.name, char: m, v: 'p' + i });
    }
    list.push({ header: 'ひかえ', v: '__hdr_roster' });
    var r = roster();
    if (!r.length) {
      list.push({ none: true, label: '（なし）', v: '__none' });
    } else {
      for (var k = 0; k < r.length; k++) {
        var rm = r[k];
        list.push({ kind: 'roster', rIdx: k, label: rm.name, char: rm, v: 'r' + k });
      }
    }
    list.push({ label: 'もどる', v: '__back', back: true });
    listCache = list;
  }
  // ヘッダー/区切り行はカーソルで止まらないよう、選択可能な行か判定する。
  function isSelectable(it) {
    return !!it && it.header == null && it.v !== '__none';
  }
  // 指定方向(dir=+1/-1)に選択可能な次の行へカーソルを進める。
  function moveCursorSelectable(dir) {
    var n = listCache.length; if (!n) return;
    for (var step = 0; step < n; step++) {
      cursor = (cursor + dir + n) % n;
      if (isSelectable(listCache[cursor])) return;
    }
  }
  // buildParty 後などにカーソルを最初の選択可能行へ補正する。
  function clampPartyCursor() {
    var n = listCache.length;
    if (cursor < 0) cursor = 0;
    if (cursor >= n) cursor = n - 1;
    if (!isSelectable(listCache[cursor])) moveCursorSelectable(1);
  }

  // ── なかまと はなす（会話イベント／掛け合い）─────────────────────────
  // 現在地(state.position.map)と「今パーティにいる仲間」で会話を出し分ける。
  // 新しい識別子は全て createMenuScene のクロージャ内＝バンドル鉄則①衝突ゼロ。
  function talkCtx() {
    var mp = String((state.position && state.position.map) || '');
    if (/town|village/.test(mp))                     return 'town';
    if (/cave|tower|shrine|castle|dungeon/.test(mp)) return 'dungeon';
    return 'field';
  }
  // 会話プール。ctx='town'|'dungeon'|'field'|'any'、who=登場に必要なキャラid。
  // ユイト(リーダー)は常にいるので who:['yuito'] の any が必ず1つは成立＝空にならない。
  function talkPool() {
    return [
      // ── まち ──
      { ctx: 'town', who: ['yuito'], lines: ['ユイト「まちは にぎやかだなあ！\nおいしい ものも いっぱいだ！」'] },
      { ctx: 'town', who: ['yuito', 'ikuma'], lines: [
        'イクマ「なあユイト、あの みせ よってこうぜ！」',
        'ユイト「いいね！つよい そうびが あるかも！」'] },
      { ctx: 'town', who: ['yuito', 'aoshi'], lines: [
        'アオシ「まちでは じょうほうを あつめよう。」',
        'ユイト「さすがアオシ、たよりに なる！」'] },
      { ctx: 'town', who: ['yuito', 'tomoki'], lines: [
        'トモキ「まちの ちびっこに 手を ふられたよ。」',
        'ユイト「トモキは みんなの にんきものだね！」'] },
      { ctx: 'town', who: ['yuito', 'itsuki'], lines: [
        'イツキ「ここは しずかで おちつくな。」',
        'ユイト「イツキも たまには のんびりしなよ！」'] },
      // ── ダンジョン ──
      { ctx: 'dungeon', who: ['yuito'], lines: ['ユイト「うわ、うすぐらいぞ…\nでも まえに すすもう！」'] },
      { ctx: 'dungeon', who: ['yuito', 'ikuma'], lines: [
        'イクマ「こういう ところ、ワクワクするな！」',
        'ユイト「イクマは こわいもの なしだな！」'] },
      { ctx: 'dungeon', who: ['yuito', 'aoshi'], lines: [
        'アオシ「わなに ちゅうい。あわてないで。」',
        'ユイト「わかった、アオシに まかせる！」'] },
      { ctx: 'dungeon', who: ['yuito', 'tomoki'], lines: [
        'トモキ「みんな、ぼくの うしろに いて。」',
        'ユイト「トモキが いると あんしんだ！」'] },
      { ctx: 'dungeon', who: ['yuito', 'itsuki'], lines: [
        'イツキ「てきの けはいが する。ゆだんするな。」',
        'ユイト「よし、みんなで のりきろう！」'] },
      // ── フィールド ──
      { ctx: 'field', who: ['yuito'], lines: ['ユイト「かぜが きもちいい！\nつぎの まちは どっちかな？」'] },
      { ctx: 'field', who: ['yuito', 'ikuma'], lines: [
        'イクマ「ユイト、そこまで きょうそうだ！」',
        'ユイト「まてよイクマ、はやすぎ！」'] },
      { ctx: 'field', who: ['yuito', 'aoshi'], lines: [
        'ユイト「アオシは いつも れいせいだね。」',
        'アオシ「…みんなが いるから、おちつける。」'] },
      // ── どこでも（any）──
      { ctx: 'any', who: ['yuito'], lines: ['ユイト「おうごんの ボールを とりもどすまで\nぜったい あきらめないぞ！」'] },
      { ctx: 'any', who: ['yuito'], lines: ['ユイト「みんなで サッカーを たのしむ。\nそれが ぼくの ゆめだ！」'] },
      { ctx: 'any', who: ['yuito', 'ikuma'], lines: [
        'イクマ「むかしは ライバルだったけど…」',
        'ユイト「いまは さいこうの しんゆうだ！」'] },
      { ctx: 'any', who: ['yuito', 'tomoki', 'itsuki'], lines: [
        'トモキ「まもりは まかせて。」',
        'イツキ「うしろは しんぱい いらない。」',
        'ユイト「さいきょうの ディフェンスだ！」'] },
      { ctx: 'any', who: ['yuito', 'ikuma', 'aoshi', 'tomoki', 'itsuki'], lines: [
        'ユイト「５にん そろえば むてきだ！」',
        'みんな「おー！！」'] },
    ];
  }
  // 現在地とパーティ編成に合う会話を1つ選ぶ。直前と同じものは避ける。
  function pickTalk() {
    var ctx = talkCtx();
    var ids = {};
    party().forEach(function (p) { if (p && p.id) ids[p.id] = true; });
    var ok = talkPool().filter(function (e) {
      if (e.ctx !== 'any' && e.ctx !== ctx) return false;
      for (var i = 0; i < e.who.length; i++) { if (!ids[e.who[i]]) return false; }
      return true;
    });
    if (!ok.length) return null;
    // 直前と同じ会話を避ける。S._talkLastId はトップレベル宣言ではなくプロパティ代入。
    var last = (S && S._talkLastId) || null;
    var pool2 = ok.filter(function (e) { return e.lines[0] !== last; });
    var use = pool2.length ? pool2 : ok;
    var pick = use[Math.floor(Math.random() * use.length)];
    if (S) S._talkLastId = pick.lines[0];
    return pick;
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
    else if (m === 'title')       buildTitle();
    else if (m === 'party')       { buildParty(); clampPartyCursor(); }
    else if (m === 'status')      { /* statusIdx は呼び出し側で設定 */ }
  }

  function onCancel() {
    switch (mode) {
      case 'main':        if (S && S.popScene) S.popScene(); break;
      case 'status':      enter('main');        break;
      case 'dex':         enter('main');        break;
      case 'ach':         enter('main');        break;
      case 'title':       enter('main');        break;
      case 'party':       enter('main');        break;
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
        case 'party':   enter('party'); break;
        case 'talk': {
          // メニューを閉じてフィールド上に会話を出す（dialog は field を透過描画する）。
          var b = pickTalk();
          if (b && S && S.createDialog && S.pushScene && S.popScene) {
            S.popScene();
            S.pushScene(S.createDialog(b.lines.slice()));
          } else {
            showMsg(['いまは はなす ことが なさそうだ。'], 'main');
          }
          break;
        }
        case 'dex':     dexIdx = 0; mode = 'dex'; cursor = 0; break;
        case 'ach':     achIdx = 0; mode = 'ach'; cursor = 0; break;
        case 'title':   enter('title');   break;
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
    if (mode === 'title') {
      if (item.v === '__back') { enter('main'); return; }
      if (item.v === '__unequip') { if (S && S.equipTitle) S.equipTitle(state, null); }
      else                        { if (S && S.equipTitle) S.equipTitle(state, item.v); }
      if (S && S.saveGame) S.saveGame(state);
      buildTitle(); return; // ★ そうび表示を更新して留まる
    }
    if (mode === 'party') {
      if (item.v === '__back') { enter('main'); return; }
      if (item.header != null || item.none) return; // ヘッダー/（なし）は無視
      var M = _monster();
      if (item.kind === 'roster') {
        // ひかえ → パーティ：満員なら誰かが出てしまうので拒否する。
        if (party().length >= maxPartyN()) {
          showMsg(['パーティが いっぱいです。\nだれかを ひかえに もどしてね'], 'party');
          return;
        }
        var okIn = M.swapInMonster ? M.swapInMonster(state, item.rIdx) : false;
        if (okIn) {
          if (S && S.saveGame) S.saveGame(state);
          buildParty(); clampPartyCursor();
        }
        return;
      }
      if (item.kind === 'party') {
        // パーティ → ひかえ：slot0(リーダー)は外せない。
        if (item.leader || item.pIdx === 0) {
          showMsg(['リーダーは はずせないよ！'], 'party');
          return;
        }
        var okOut = M.sendToRoster ? M.sendToRoster(state, item.pIdx) : false;
        if (okOut) {
          if (S && S.saveGame) S.saveGame(state);
          buildParty(); clampPartyCursor();
        }
        return;
      }
      return;
    }
  }

  // ── 描画 ──
  function drawMainPanel(ctx) {
    // コマンド窓（左）：項目数に応じて高さを可変にしてはみ出しを防ぐ。
    var n = listCache.length, rowH = 24;
    var lh = Math.max(196, 44 + n * rowH);
    S.drawWindow(ctx, 12, 24, 116, lh, { radius: 10, border: '#5ec8ff' });
    S.drawText(ctx, 'メニュー', 70, 32, { size: 13, color: '#ffd76e', align: 'center' });
    for (var i = 0; i < n; i++) {
      var y = 54 + i * rowH;
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
    // 下部はアイテム説明フッター用に空ける（どうぐ／そうびで効果が分かるように）。
    var top = Y + 38, rowH = 24;
    for (var i = 0; i < listCache.length; i++) {
      var y = top + i * rowH;
      if (y > Y + H - 52) break;
      if (i === cursor) S.drawText(ctx, '▶', X + 12, y, { size: 13, color: '#ffd76e' });
      S.drawText(ctx, listCache[i].label, X + 32, y, { size: 13, color: i === cursor ? '#ffffff' : '#cfe0ff' });
    }
    // 選択中アイテムの説明（v がアイテムidの時だけ＝どうぐ・そうび えらぶ）。
    var cur = listCache[cursor];
    var det = cur && cur.v ? ITEMS()[cur.v] : null;
    if (det && det.desc) {
      var dy = Y + H - 42;
      var dl = (S.wrapText ? S.wrapText(det.desc, 20) : [det.desc]);
      for (var d = 0; d < Math.min(2, dl.length); d++) {
        S.drawText(ctx, dl[d], X + 16, dy + d * 16, { size: 11, color: '#bfe6c8' });
      }
    }
  }

  function drawStatusPanel(ctx) {
    var m = party()[statusIdx]; if (!m) return;
    var X = 16, Y = 24, W = VW - 32, H = 320;
    S.drawWindow(ctx, X, Y, W, H, { radius: 10, border: '#5ec8ff' });
    // キャラ絵：AI立ち絵(ALLY_ART)を優先。未デコード/無しならドット絵(SPRITES)へフォールバック。
    //   キャッシュキーは battle-scene の _drawAllies と同じ 'ally_'+id にしてデコード結果を共有する。
    var portraitArt = (S.ALLY_ART && S.ALLY_ART[m.id]) || null;
    var drewPortrait = false;
    if (portraitArt && S.drawImageSprite) {
      drewPortrait = !!S.drawImageSprite(ctx, 'ally_' + m.id, portraitArt, X + 46, Y + 56, 80, false);
    }
    if (!drewPortrait && S.SPRITES && S.SPRITES[m.id]) S.drawSprite(ctx, S.SPRITES[m.id], X + 16, Y + 14, 2);
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

  function drawDexPanel(ctx) {
    var keys = Object.keys(ENEMIES());
    var dex = state.dex || {};
    var seenCount = keys.filter(function (k) { return (dex[k] || 0) > 0; }).length;
    if (dexIdx >= keys.length) dexIdx = 0;
    var key = keys[dexIdx];
    var e = ENEMIES()[key] || {};
    var count = dex[key] || 0;
    var seen = count > 0;

    var X = 16, Y = 24, W = VW - 32, H = 320;
    S.drawWindow(ctx, X, Y, W, H, { radius: 10, border: '#5ec8ff' });
    S.drawText(ctx, 'モンスターずかん', X + W / 2, Y + 12, { size: 14, color: '#ffd76e', align: 'center' });
    S.drawText(ctx, 'No.' + (dexIdx + 1) + ' / ' + keys.length, X + 16, Y + 36, { size: 11, color: '#a8c0e0' });
    S.drawText(ctx, 'はっけん ' + seenCount + ' / ' + keys.length, X + W - 16, Y + 36, { size: 11, color: '#a8c0e0', align: 'right' });

    // 敵スプライト：発見済みで AI絵(ENEMY_ART)があれば描画。無ければ ？ プレースホルダ。
    var art = (S.ENEMY_ART && S.ENEMY_ART[key]) || null;
    var cx = X + W / 2, cy = Y + 96;
    var drew = false;
    if (seen && art && S.drawImageSprite) {
      drew = !!S.drawImageSprite(ctx, key, art, cx, cy, 88);
    }
    if (!drew) {
      // 未発見＝？／発見済みでも絵が無い敵（隠しボス等）は色つきの丸で代用。
      if (seen) {
        ctx.save();
        ctx.fillStyle = '#6a4bce';
        ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff5a7a';
        ctx.beginPath();
        ctx.arc(cx - 10, cy - 4, 5, 0, Math.PI * 2);
        ctx.arc(cx + 10, cy - 4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        S.drawText(ctx, '？', cx, cy - 18, { size: 48, color: '#3a5a8a', align: 'center' });
      }
    }

    var by = Y + 150;
    if (seen) {
      S.drawText(ctx, e.name + (e.isBoss ? '（ボス）' : ''), X + W / 2, by, { size: 16, color: '#ffffff', align: 'center' });
      S.drawText(ctx, 'タイプ：' + typeLabel(e.type), X + W / 2, by + 24, { size: 12, color: '#cfe0ff', align: 'center' });
      var rows = [
        ['HP', '' + (e.hp || 0)],
        ['こうげき', '' + (e.atk || 0)],
        ['まもり', '' + (e.def || 0)],
        ['すばやさ', '' + (e.spd || 0)],
        ['たおした かず', '' + count],
      ];
      var ry = by + 48;
      for (var i = 0; i < rows.length; i++) {
        var yy = ry + i * 22;
        S.drawText(ctx, rows[i][0], X + 28, yy, { size: 12, color: '#a8c0e0' });
        S.drawText(ctx, rows[i][1], X + W - 28, yy, { size: 13, color: '#ffffff', align: 'right' });
      }
    } else {
      S.drawText(ctx, '？？？', X + W / 2, by, { size: 16, color: '#8090b0', align: 'center' });
      S.drawText(ctx, 'まだ であって いない…', X + W / 2, by + 28, { size: 12, color: '#8090b0', align: 'center' });
    }
    S.drawText(ctx, '◀ ▶ きりかえ / ✕ もどる', X + W / 2, Y + H - 20, { size: 10, color: '#88a0c0', align: 'center' });
  }

  function drawAchPanel(ctx) {
    var list = ACHIEVEMENTS();
    var got = state.achievements || {};
    var doneCount = list.filter(function (a) { return !!got[a.id]; }).length;

    var X = 16, Y = 24, W = VW - 32, H = 320;
    S.drawWindow(ctx, X, Y, W, H, { radius: 10, border: '#5ec8ff' });
    S.drawText(ctx, 'じっせき', X + W / 2, Y + 12, { size: 14, color: '#ffd76e', align: 'center' });
    S.drawText(ctx, 'かいじょ ' + doneCount + ' / ' + list.length, X + W / 2, Y + 34, { size: 11, color: '#a8c0e0', align: 'center' });

    var perPage = 8, rowH = 30, top = Y + 54;
    for (var i = 0; i < perPage; i++) {
      var idx = achIdx + i;
      if (idx >= list.length) break;
      var a = list[idx];
      var unlocked = !!got[a.id];
      var y = top + i * rowH;
      // 達成マーク（★＝かいじょ済／・＝みかいじょ）
      S.drawText(ctx, unlocked ? '★' : '・', X + 14, y, { size: 14, color: unlocked ? '#ffd76e' : '#5a6a8a' });
      S.drawText(ctx, unlocked ? a.name : '？？？', X + 34, y, { size: 13, color: unlocked ? '#ffffff' : '#8090b0' });
      S.drawText(ctx, unlocked ? a.desc : 'みかいじょ', X + 34, y + 14, { size: 9, color: unlocked ? '#a8c0e0' : '#5a6a8a' });
    }
    // スクロール位置の目印（先頭/末尾でない時に上下三角）
    if (achIdx > 0)                          S.drawText(ctx, '▲', X + W - 18, top - 2,        { size: 10, color: '#88a0c0', align: 'center' });
    if (achIdx + perPage < list.length)      S.drawText(ctx, '▼', X + W - 18, Y + H - 38,    { size: 10, color: '#88a0c0', align: 'center' });
    S.drawText(ctx, '▲ ▼ スクロール / ✕ もどる', X + W / 2, Y + H - 20, { size: 10, color: '#88a0c0', align: 'center' });
  }

  function drawTitlePanel(ctx) {
    var total = TITLES().length;
    var gotCount = unlockedTitles().length;

    var X = 16, Y = 24, W = VW - 32, H = 320;
    S.drawWindow(ctx, X, Y, W, H, { radius: 10, border: '#5ec8ff' });
    S.drawText(ctx, 'しょうごう', X + W / 2, Y + 12, { size: 14, color: '#ffd76e', align: 'center' });
    S.drawText(ctx, 'てにいれた ' + gotCount + ' / ' + total, X + W / 2, Y + 34, { size: 11, color: '#a8c0e0', align: 'center' });

    // スクロール：カーソルを中央付近に保ちつつ範囲内に収める。
    var maxRows = 7, rowH = 32, top = Y + 56;
    var first = Math.min(Math.max(0, cursor - Math.floor(maxRows / 2)), Math.max(0, listCache.length - maxRows));
    for (var i = 0; i < maxRows; i++) {
      var idx = first + i;
      if (idx >= listCache.length) break;
      var it = listCache[idx];
      var y = top + i * rowH;
      var sel = idx === cursor;
      if (sel) S.drawText(ctx, '▶', X + 10, y, { size: 13, color: '#ffd76e' });
      // 装備中マーク（★）
      if (it.equipped) S.drawText(ctx, '★', X + 28, y, { size: 13, color: '#ffd76e' });
      var nameColor = it.back ? '#9fb4d8' : (sel ? '#ffffff' : '#cfe0ff');
      S.drawText(ctx, it.label, X + 46, y, { size: 13, color: nameColor });
      // ボーナス（右寄せ）：称号のみ表示。しょうごうなし／もどるは '—'。
      if (it.bonus) {
        var b = 'こう+' + (it.bonus.atk || 0) + ' まも+' + (it.bonus.def || 0);
        S.drawText(ctx, b, X + W - 14, y, { size: 11, color: '#a8e0b0', align: 'right' });
      } else if (it.none) {
        S.drawText(ctx, '—', X + W - 14, y, { size: 11, color: '#5a6a8a', align: 'right' });
      }
      // 説明（称号のみ・1行小さく）
      if (it.desc) S.drawText(ctx, it.desc, X + 46, y + 14, { size: 9, color: sel ? '#a8c0e0' : '#7f93b8' });
    }
    if (first > 0)                              S.drawText(ctx, '▲', X + W - 18, top - 4,     { size: 10, color: '#88a0c0', align: 'center' });
    if (first + maxRows < listCache.length)     S.drawText(ctx, '▼', X + W - 18, Y + H - 38,  { size: 10, color: '#88a0c0', align: 'center' });
    S.drawText(ctx, '▲ ▼ えらぶ / けってい そうび / ✕ もどる', X + W / 2, Y + H - 20, { size: 10, color: '#88a0c0', align: 'center' });
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
      if (mode === 'dex') {
        if (pressed.cancel) { onCancel(); return; }
        var en = Object.keys(ENEMIES()).length || 1;
        if (pressed.left)  dexIdx = (dexIdx - 1 + en) % en;
        if (pressed.right) dexIdx = (dexIdx + 1) % en;
        return;
      }
      if (mode === 'ach') {
        if (pressed.cancel) { onCancel(); return; }
        var an = ACHIEVEMENTS().length;
        var perPage = 8; // 1画面に収まる行数（drawAchPanel と合わせる）
        var maxTop = Math.max(0, an - perPage);
        if (pressed.up)   achIdx = Math.max(0, achIdx - 1);
        if (pressed.down) achIdx = Math.min(maxTop, achIdx + 1);
        return;
      }

      if (mode === 'party') {
        // ヘッダー/（なし）行は飛ばして選択可能行だけを上下移動する。
        if (pressed.up)      moveCursorSelectable(-1);
        if (pressed.down)    moveCursorSelectable(1);
        if (pressed.cancel)  { onCancel(); return; }
        if (pressed.confirm) { onConfirm(listCache[cursor]); return; }
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
      else if (mode === 'dex')     drawDexPanel(ctx);
      else if (mode === 'ach')     drawAchPanel(ctx);
      else if (mode === 'title')   drawTitlePanel(ctx);
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
