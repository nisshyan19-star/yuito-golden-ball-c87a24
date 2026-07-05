// === title-scene.js ===
// タイトル画面シーン。「はじめから」「つづきから」を選択して冒険へ。
// window/document はすべて関数内でのみアクセスし、Node require でも副作用ゼロ。

/**
 * _createStubScene: フィールドシーン（Task10）が未実装の間の仮代用シーン。
 */
function _createStubScene(state) {
  return {
    update: function (dt, input) {
      if (input && input.pressed && input.pressed.cancel) {
        if (typeof window !== 'undefined' && window.SRPG) {
          window.SRPG.replaceScene(createTitleScene());
        }
      }
    },
    draw: function (ctx) {
      var S = (typeof window !== 'undefined') ? window.SRPG : null;
      if (!S) return;
      ctx.fillStyle = '#13203a';
      ctx.fillRect(0, 0, S.VW, S.VH);
      S.drawText(ctx, 'ぼうけんのはじまり！', S.VW / 2, S.VH / 2 - 40, {
        size: 20, color: '#ffd76e', align: 'center', shadow: true, weight: 'bold',
      });
      S.drawText(ctx, '（フィールドは Task10 でつくるよ）', S.VW / 2, S.VH / 2, {
        size: 13, color: '#aaccff', align: 'center',
      });
      S.drawText(ctx, '「もどる」で タイトルへ', S.VW / 2, S.VH / 2 + 30, {
        size: 13, color: '#aaaaaa', align: 'center',
      });
    },
  };
}

/**
 * _startGame: フィールドシーン or スタブへ遷移する。
 * Task10 で field-scene.js が追加されれば自動的にフィールドへ遷移する。
 */
function _startGame(state) {
  if (typeof window !== 'undefined' && window.SRPG) {
    var S = window.SRPG;
    if (typeof S.createFieldScene === 'function') {
      S.replaceScene(S.createFieldScene(state));
    } else {
      S.replaceScene(_createStubScene(state));
    }
  }
}

/**
 * createTitleScene: タイトル画面シーンを生成して返す。
 * @returns シーンオブジェクト { update, draw }
 */
function createTitleScene() {
  // 選択項目: 0=はじめから, 1=つづきから, 2=つよくてニューゲーム（クリア済みのみ）, 3=なかま ずかん, 4=こうしんりれき
  var _cursor = 0; // 現在のカーソル位置
  var _time   = 0; // アニメーション用タイマー
  var _mode   = 'main'; // 'main' | 'difficulty' | 'chars'（なかま ずかん）| 'changelog'（こうしんりれき）
  var _diffCursor = 1;  // 0=やさしい 1=ふつう 2=むずかしい（既定ふつう）
  var _charCursor = 0;  // なかま ずかん で表示中のなかま index
  var _ZUKAN_IDS  = ['yuito', 'ikuma', 'aoshi', 'tomoki', 'itsuki']; // 表示順
  var _clScroll   = 0;  // こうしんりれき の スクロール位置（ピクセル）

  // ── オープニングデモ（アトラクトモード）用の状態 ──
  //   タイトルを むそうさで ほうっておくと、じどうで ムービーが ながれる。
  //   ゲームセンターの きょうたい みたいな えんしゅつ。どれか おすと タイトルへ もどる。
  //   ※ここで足す 識別子は すべて createTitleScene() の クロージャ内＝バンドル鉄則①（トップレベル衝突ゼロ）。
  var _idle       = 0;   // main モードで むそうさが つづいた 秒数
  var _demoT      = 0;   // デモ再生の けいか秒（0 から すすむ）
  var _IDLE_LIMIT = 15;  // これ以上 むそうさで デモ開始（秒）

  // こうしんりれき（更新履歴）＝ゲームが どんどん おおきくなった きろく。あたらしい順。
  //   こどもが よめる ひらがな中心。t=みだし（絵文字つき）, d=せつめい, v=バッジ。
  var _CHANGELOG = [
    { v: 'NEW', t: '⚽ サッカーミニゲーム', d: 'リフティングと まとあてに ちょうせん！フォレストタウンの コーチに かとう！' },
    { v: '',    t: '💧 みずの どうくつ',   d: 'あたらしい ダンジョン。ボスは アクア・ゴーレム！' },
    { v: '',    t: '🔊 こうかおん',         d: 'こうげき・かいふく・たからばこに おとが ついたよ！' },
    { v: '',    t: '📖 ものがたり パワーアップ', d: 'プロローグの えほん、なかま ずかん、エンディングが ふえた！' },
    { v: '',    t: '🌿 もりの しんでん',   d: 'こもれびの ダンジョン。まもりがみ ガイアが まっている！' },
    { v: '',    t: '❄️ こおりの とう',     d: 'ふぶきの 3かいだて。てっぺんに アイス・ゴーレム！' },
    { v: '',    t: '🔥 ほのおの どうくつ', d: 'マグマゴーレムが まもる あつい どうくつ！' },
    { v: '',    t: '🏡 みのりの村',         d: 'ひろい 村。井戸・はたけ・村人と おはなし できる！' },
    { v: '',    t: '🔨 かじや',             d: 'そざいを あつめて そうびを つよく できる！' },
    { v: '',    t: '🐾 なかまモンスター',   d: 'たおした てきを なかまに して いっしょに たたかえる！' },
    { v: '',    t: '🏆 トーナメント',       d: 'PK戦から 3れんせんの サッカーたいかいへ！' },
    { v: '',    t: '⭐ しょうごう',         d: 'じっせきを あつめて つよくなる しょうごうシステム！' },
    { v: '',    t: '🌟 だい2しょう',        d: 'あたらしい まち・ボス・ストーリーが つづく！' },
    { v: 'はじまり', t: '🎮 ぼうけん スタート', d: 'ユイトと なかまたちの ぼうけんが はじまった！' },
  ];

  // クリア済みセーブかの判定は loadGame が要るので、一度だけ調べてキャッシュする
  //   （毎フレームのデシリアライズを避ける。タイトル滞在中はセーブが変わらない前提）。
  var _clearedCache = null;
  function _hasClearedSave() {
    if (_clearedCache !== null) return _clearedCache;
    var S = (typeof window !== 'undefined') ? window.SRPG : null;
    var hasSave = S && typeof S.hasSave === 'function' && S.hasSave();
    var saved = (hasSave && typeof S.loadGame === 'function') ? S.loadGame() : null;
    _clearedCache = !!(saved && saved.flags && saved.flags.game_cleared);
    return _clearedCache;
  }

  // 難易度の選択肢（v は settings.difficulty に入れる値）
  var DIFFS = [
    { v: 'easy',   label: 'やさしい',   desc: 'てきは つよめ・たおれても ぜんかいふく' },
    { v: 'normal', label: 'ふつう',     desc: 'てきが つよい・てごたえ あり' },
    { v: 'hard',   label: 'むずかしい', desc: 'てきが とても つよい・ほうしゅう おおい' },
  ];

  // 難易度を決めて冒険を始める
  function _beginNewGame(S, diff) {
    var newState = S.createNewGame();
    newState.settings = newState.settings || {};
    newState.settings.difficulty = diff;
    S.saveGame(newState);
    S.pushScene(S.createDialog(
      [
        'むかし むかし。\nそらの かなたから\nひとつの ボールが おくられた。',
        'こがねに かがやく\n「おうごんの サッカーボール」。',
        'ボールの あつまる まち、\nその なは ―― ピッチランド。',
        'ところが ある ひ――\nやみの ていおう\nダーク・カイザーが あらわれた！',
        'カイザーは おうごんの ボールを\nうばって いった！',
        'こがねの ひかりが きえると、\nまちから いろが きえ、\nえがおも きえていく……',
        'でも ひとりだけ、あきらめない\nしょうねんが いた。',
        'サッカーだいすきな 9さいの\nしょうねん、ユイトだ。',
        'ユイト「ぼくが おうごんの\nボールを とりもどす！\nなかまを さがしに いこう！」',
        'いま、ユイトの ぼうけんが\nはじまる――！',
      ],
      { onComplete: function () { _startGame(newState); } }
    ));
  }

  // つよくてニューゲーム（追加弾4-C）：クリア済みセーブを ひきついで 2しゅうめへ。
  function _beginNewGamePlus(S) {
    if (typeof S.createNewGamePlus !== 'function') return;
    var prev = S.loadGame();
    if (!prev) return;
    var ng = S.createNewGamePlus(prev);
    S.saveGame(ng);
    S.pushScene(S.createDialog(
      [
        'つよくて ニューゲーム！',
        'レベルや そうび、なかまは そのまま。つよくなった てきに もういちど ちょうせんだ！',
        'これで ' + (ng.clearCount + 1) + 'しゅうめ！ がんばれ ユイト！',
      ],
      { onComplete: function () { _startGame(ng); } }
    ));
  }

  // 選択可能な項目インデックスの配列を動的に返す。
  //   セーブ無し＝「はじめから」のみ／セーブ有り＝＋「つづきから」／
  //   クリア済みセーブ＝さらに「つよくてニューゲーム」。
  function _selectableItems() {
    var S = (typeof window !== 'undefined') ? window.SRPG : null;
    var hasSave = S && typeof S.hasSave === 'function' && S.hasSave();
    var items = [0];                          // はじめから（いつでも）
    if (hasSave) {
      items.push(1);                          // つづきから
      if (_hasClearedSave()) items.push(2);   // つよくてニューゲーム
    }
    items.push(3);                            // なかま ずかん（いつでも）
    items.push(4);                            // こうしんりれき（いつでも）
    return items;
  }

  // なかま ずかんの1ページ（立ち絵＋プロフィール）を描く。
  //   VW=288 の狭い画面でも崩れないよう、しょうかい文は measureText で折り返す。
  function _drawZukan(ctx, S, VW) {
    var id = _ZUKAN_IDS[_charCursor];
    var ch = (S.CHARACTERS && S.CHARACTERS[id]) || null;
    var pf = (ch && ch.profile) || {};

    var typeColors = { power: '#ff8a5c', speed: '#5cd0ff', technique: '#b98aff' };
    var typeNames  = { power: 'パワー',  speed: 'スピード', technique: 'テクニック' };
    var accent = (ch && typeColors[ch.type]) || '#ffd76e';

    // ピクセル幅で日本語を折り返す（空白でなく1文字ずつ詰める）
    function wrap(text, maxW, size) {
      ctx.font = size + 'px "Hiragino Maru Gothic ProN","Hiragino Kaku Gothic ProN",sans-serif';
      var out = [], line = '';
      for (var i = 0; i < text.length; i++) {
        var c = text[i], t = line + c;
        if (line !== '' && ctx.measureText(t).width > maxW) {
          out.push(line);
          line = (c === ' ' || c === '　') ? '' : c;
        } else {
          line = t;
        }
      }
      if (line !== '') out.push(line);
      return out;
    }

    // 背景を少し沈める（スタジアムを残したまま読みやすく）
    ctx.fillStyle = 'rgba(4,7,15,0.62)';
    ctx.fillRect(0, 0, VW, 357);

    var winX = 12, winY = 62, winW = VW - 24, winH = 288;
    S.drawWindow(ctx, winX, winY, winW, winH, { radius: 10, border: '#c89a4a' });

    // 見出し＋ページ番号
    S.drawText(ctx, '★ なかま ずかん ★', VW / 2, winY + 8, {
      size: 13, color: '#ffd76e', align: 'center', weight: 'bold',
    });
    S.drawText(ctx, (_charCursor + 1) + ' / ' + _ZUKAN_IDS.length, winX + winW - 10, winY + 9, {
      size: 10, color: '#9fb6da', align: 'right',
    });

    // 立ち絵（左）＋足元の影
    var pcx = winX + 50, pcy = winY + 58, ph = 84;
    S.drawShadow(ctx, pcx, pcy + ph / 2 - 2, 28, 6);
    var art = S.ALLY_ART && S.ALLY_ART[id];
    var drew = false;
    if (art && typeof S.drawImageSprite === 'function') {
      drew = S.drawImageSprite(ctx, 'zukan_' + id, art, pcx, pcy, ph, false);
    }
    if (!drew && S.SPRITES && S.SPRITES[id]) {
      var sp = S.SPRITES[id], sc = 4;
      var sw = sp.map[0].length * sc, sh = sp.map.length * sc;
      S.drawSprite(ctx, sp, Math.floor(pcx - sw / 2), Math.floor(pcy - sh / 2), sc);
    }

    // 右側：名前・ポジション・タイプ・ねんれい
    var rx = winX + 106;
    S.drawText(ctx, (ch && ch.name) || '？', rx, winY + 24, {
      size: 20, color: accent, align: 'left', weight: 'bold', shadow: true,
    });
    S.drawText(ctx, (ch && ch.position) || '', rx, winY + 50, {
      size: 11, color: '#dff4ff', align: 'left',
    });
    S.drawText(ctx, 'タイプ：' + ((ch && typeNames[ch.type]) || '－'), rx, winY + 68, {
      size: 10, color: accent, align: 'left',
    });
    S.drawText(ctx, 'ねんれい：' + (pf.age || '？'), rx, winY + 84, {
      size: 10, color: '#9fb6da', align: 'left',
    });

    // 二つ名（立ち絵の下に逃がす）
    S.drawText(ctx, '『 ' + (pf.flavor || '') + ' 』', VW / 2, winY + 110, {
      size: 11, color: '#ffe89a', align: 'center',
    });

    // 区切り線
    ctx.strokeStyle = 'rgba(200,154,74,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(winX + 14, winY + 128);
    ctx.lineTo(winX + winW - 14, winY + 128);
    ctx.stroke();

    // しょうかい文（bio）＝折り返して描く
    var maxW = winW - 28;
    var y = winY + 136;
    var bio = pf.bio || [];
    for (var bi = 0; bi < bio.length; bi++) {
      var lines = wrap(bio[bi], maxW, 10);
      for (var li = 0; li < lines.length; li++) {
        S.drawText(ctx, lines[li], winX + 14, y, { size: 10, color: '#e8f0ff', align: 'left' });
        y += 15;
      }
    }

    // ゆめ
    y += 4;
    S.drawText(ctx, '【 ゆめ 】', winX + 14, y, {
      size: 11, color: accent, align: 'left', weight: 'bold',
    });
    y += 16;
    var dlines = wrap(pf.dream || '', maxW, 10);
    for (var di2 = 0; di2 < dlines.length; di2++) {
      S.drawText(ctx, dlines[di2], winX + 14, y, { size: 10, color: '#ffe89a', align: 'left' });
      y += 15;
    }

    // 左右の点滅矢印（きりかえ）＋操作ヒント
    var blink = Math.floor(_time / 0.4) % 2 === 0;
    if (blink) {
      S.drawText(ctx, '◀', winX + 2,          pcy - 9, { size: 18, color: '#ffd76e', align: 'left' });
      S.drawText(ctx, '▶', winX + winW - 2,   pcy - 9, { size: 18, color: '#ffd76e', align: 'right' });
    }
    S.drawText(ctx, '◀▶ できりかえ　「もどる」でタイトルへ', VW / 2, winY + winH - 16, {
      size: 9, color: '#cfe0ff', align: 'center',
    });
  }

  // こうしんりれき（更新履歴）を描く。ピクセル単位でスクロールし、内容量に応じてクランプ。
  function _drawChangelog(ctx, S, VW) {
    // ピクセル幅で日本語を折り返す（_drawZukan と同じ手法）
    function wrap(text, maxW, size) {
      ctx.font = size + 'px "Hiragino Maru Gothic ProN","Hiragino Kaku Gothic ProN",sans-serif';
      var out = [], line = '';
      for (var i = 0; i < text.length; i++) {
        var c = text[i], t = line + c;
        if (line !== '' && ctx.measureText(t).width > maxW) {
          out.push(line);
          line = (c === ' ' || c === '　') ? '' : c;
        } else {
          line = t;
        }
      }
      if (line !== '') out.push(line);
      return out;
    }

    // 背景を沈めて読みやすく（スタジアムは うっすら残す）
    ctx.fillStyle = 'rgba(4,7,15,0.62)';
    ctx.fillRect(0, 0, VW, 357);

    var winX = 12, winY = 62, winW = VW - 24, winH = 288;
    S.drawWindow(ctx, winX, winY, winW, winH, { radius: 10, border: '#c89a4a' });

    // 見出し
    S.drawText(ctx, '★ こうしんりれき ★', VW / 2, winY + 8, {
      size: 13, color: '#ffd76e', align: 'center', weight: 'bold',
    });

    // エントリを描画ライン列（高さ付き）に展開
    var maxW = winW - 34;
    var lines = [];
    for (var ei = 0; ei < _CHANGELOG.length; ei++) {
      var e = _CHANGELOG[ei];
      if (ei > 0) lines.push({ kind: 'gap', h: 7 });               // エントリ間の余白
      lines.push({ kind: 'title', text: '● ' + e.t, badge: e.v, h: 18 });
      var dl = wrap(e.d, maxW, 10);
      for (var li = 0; li < dl.length; li++) {
        lines.push({ kind: 'desc', text: dl[li], h: 15 });
      }
    }

    // 表示エリア＆スクロール量のクランプ（ピクセル）
    var viewTop = winY + 28, viewH = winH - 46;
    var totalH = 0;
    for (var ti = 0; ti < lines.length; ti++) totalH += lines[ti].h;
    var maxScroll = Math.max(0, totalH - viewH);
    if (_clScroll > maxScroll) _clScroll = maxScroll;
    if (_clScroll < 0) _clScroll = 0;

    // クリップして描く
    ctx.save();
    ctx.beginPath();
    ctx.rect(winX + 6, viewTop, winW - 12, viewH);
    ctx.clip();
    var yy = viewTop - _clScroll;
    for (var di = 0; di < lines.length; di++) {
      var ln = lines[di];
      if (yy + ln.h > viewTop && yy < viewTop + viewH) {
        if (ln.kind === 'title') {
          S.drawText(ctx, ln.text, winX + 14, yy, {
            size: 11, color: '#ffe89a', align: 'left', weight: 'bold',
          });
          if (ln.badge) {
            S.drawText(ctx, ln.badge, winX + winW - 12, yy, {
              size: 9, color: '#7fe0a0', align: 'right', weight: 'bold',
            });
          }
        } else if (ln.kind === 'desc') {
          S.drawText(ctx, '　' + ln.text, winX + 14, yy, {
            size: 10, color: '#e8f0ff', align: 'left',
          });
        }
      }
      yy += ln.h;
    }
    ctx.restore();

    // スクロール矢印（内容が続く方向だけ点滅表示）
    var blink = Math.floor(_time / 0.4) % 2 === 0;
    if (blink && _clScroll > 0) {
      S.drawText(ctx, '▲', VW / 2, winY + 24, { size: 12, color: '#ffd76e', align: 'center' });
    }
    if (blink && _clScroll < maxScroll) {
      S.drawText(ctx, '▼', VW / 2, winY + winH - 30, { size: 12, color: '#ffd76e', align: 'center' });
    }

    // 操作ヒント
    S.drawText(ctx, '▲▼ でスクロール　「もどる」でタイトルへ', VW / 2, winY + winH - 14, {
      size: 9, color: '#cfe0ff', align: 'center',
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  オープニングデモ（アトラクトモード）
  //   むそうさで タイトルを ほうっておくと ながれる スライドショー式ムービー。
  //   じっさいの ゲームプレイを 自動操作するのではなく、名場面カードを
  //   フェードで つなぐ 演出＝安全（セーブや状態を さわらない）。
  //   絵は 既存の ALLY_ART / ENEMY_ART を流用＝新規アート 0（サイズを ふやさない）。
  // ════════════════════════════════════════════════════════════════
  var _DEMO = [
    { kind: 'logo',    dur: 3.4 },
    { kind: 'story',   dur: 5.2 },
    { kind: 'villain', dur: 3.8 },
    { kind: 'heroes',  dur: 4.6 },
    { kind: 'worlds',  dur: 4.6 },
    { kind: 'cta',     dur: 3.4 },
  ];
  function _demoTotal() {
    var t = 0;
    for (var i = 0; i < _DEMO.length; i++) t += _DEMO[i].dur;
    return t;
  }
  // 経過時間 t から 現在スライド index・スライド内経過・スライド長 を返す
  function _demoAt(t) {
    var acc = 0;
    for (var i = 0; i < _DEMO.length; i++) {
      if (t < acc + _DEMO[i].dur) return { i: i, local: t - acc, dur: _DEMO[i].dur };
      acc += _DEMO[i].dur;
    }
    var last = _DEMO.length - 1;
    return { i: last, local: _DEMO[last].dur, dur: _DEMO[last].dur };
  }

  function _drawDemo(ctx, S, VW, VH) {
    // ── 背景：ドラマチックな夜空グラデ＋またたく星（フェードの外＝つねに表示） ──
    var bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0,   '#04060e');
    bg.addColorStop(0.5, '#0b1024');
    bg.addColorStop(1,   '#140a24');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);
    var stars = [[24,40],[70,90],[130,30],[200,70],[250,45],[40,150],[210,140],
                 [270,110],[100,180],[160,120],[20,220],[260,210],[140,60],[60,250],[200,300]];
    for (var si = 0; si < stars.length; si++) {
      var tw = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(_time * 2.2 + si * 1.3));
      ctx.fillStyle = 'rgba(255,255,255,' + tw.toFixed(3) + ')';
      var sz = (si % 3 === 0) ? 2 : 1;
      ctx.fillRect(stars[si][0], stars[si][1], sz, sz);
    }

    // ── 現在スライド＋フェード（入り0.5s／出0.5s） ──
    var at = _demoAt(_demoT);
    var slide = _DEMO[at.i];
    var fade = Math.min(1, at.local / 0.5) * Math.min(1, (at.dur - at.local) / 0.5);
    if (fade < 0) fade = 0;
    if (fade > 1) fade = 1;

    ctx.save();
    ctx.globalAlpha = fade;

    if (slide.kind === 'logo') {
      // ロゴ大写し＋発光
      ctx.save();
      ctx.shadowColor = 'rgba(255,176,42,0.85)';
      ctx.shadowBlur  = 16 + 6 * Math.sin(_time * 2.4);
      S.drawText(ctx, 'ユイトと黄金の', VW / 2, 96,  { size: 26, color: '#ffd24a', align: 'center', weight: 'bold' });
      S.drawText(ctx, 'サッカーボール', VW / 2, 132, { size: 26, color: '#ffd24a', align: 'center', weight: 'bold' });
      ctx.restore();
      S.drawText(ctx, 'こがねの ボールを とりもどせ！', VW / 2, 176, { size: 13, color: '#cfe0ff', align: 'center' });
      var gb = S.ENEMY_ART && S.ENEMY_ART.golden_ball;
      if (gb && typeof S.drawImageSprite === 'function') {
        var bob = Math.sin(_time * 2) * 5;
        S.drawImageSprite(ctx, 'demo_ball', gb, VW / 2, 250 + bob, 74, false);
      }

    } else if (slide.kind === 'story') {
      S.drawText(ctx, '★ ものがたり ★', VW / 2, 48, { size: 15, color: '#ffd76e', align: 'center', weight: 'bold' });
      var story = [
        'へいわだった ピッチランドに',
        'やみの ていおう ダーク・カイザーが',
        'あらわれた。',
        'おうごんの サッカーボールを うばい、',
        'まちから いろと えがおが きえた……',
        'たちあがったのは、サッカーが だいすきな',
        '9さいの しょうねん、ユイト！',
      ];
      var sy = 104;
      for (var li = 0; li < story.length; li++) {
        S.drawText(ctx, story[li], VW / 2, sy, { size: 12, color: '#eaf2ff', align: 'center' });
        sy += 28;
      }

    } else if (slide.kind === 'villain') {
      // ラスボス ドーン（赤紫オーラ＋既存 dark_kaiser アート）
      var kx = VW / 2, kFoot = 300, kH = 190, kCy = kFoot - kH / 2;
      var pulse = 0.5 + 0.5 * Math.sin(_time * 1.8);
      var aura = ctx.createRadialGradient(kx, kCy, 8, kx, kCy, 118 + pulse * 18);
      aura.addColorStop(0,   'rgba(190,40,90,' + (0.30 + pulse * 0.16).toFixed(3) + ')');
      aura.addColorStop(0.5, 'rgba(100,26,116,0.16)');
      aura.addColorStop(1,   'rgba(100,26,116,0)');
      ctx.fillStyle = aura;
      ctx.fillRect(kx - 150, kFoot - kH - 20, 300, kH + 52);
      var kart = S.ENEMY_ART && S.ENEMY_ART.dark_kaiser;
      if (kart && typeof S.drawImageSprite === 'function') {
        S.drawImageSprite(ctx, 'demo_kaiser', kart, kx, kCy, kH, false);
      }
      S.drawText(ctx, 'やみの ていおう', VW / 2, 44, { size: 13, color: '#ff9ab0', align: 'center' });
      S.drawText(ctx, 'ダーク・カイザー', VW / 2, 64, { size: 22, color: '#ff5c7a', align: 'center', weight: 'bold', shadow: true });
      S.drawText(ctx, 'おうごんの ボールを うばった!!', VW / 2, 316, { size: 13, color: '#ffd76e', align: 'center', weight: 'bold' });

    } else if (slide.kind === 'heroes') {
      S.drawText(ctx, '5にんの なかまと ぼうけんへ！', VW / 2, 46, { size: 14, color: '#ffd76e', align: 'center', weight: 'bold' });
      var order = [
        { id: 'aoshi',  x: 40  },
        { id: 'ikuma',  x: 92  },
        { id: 'yuito',  x: 144 },
        { id: 'tomoki', x: 196 },
        { id: 'itsuki', x: 248 },
      ];
      var foot = 300;
      for (var hi = 0; hi < order.length; hi++) {
        var o = order[hi];
        var isY = (o.id === 'yuito');
        var h = isY ? 152 : 118;
        var b = Math.sin(_time * 1.8 + hi * 0.7) * 3;
        S.drawShadow(ctx, o.x, foot - 2 + b, h * 0.22, h * 0.05);
        var url = S.ALLY_ART && S.ALLY_ART[o.id];
        if (url && typeof S.drawImageSprite === 'function') {
          S.drawImageSprite(ctx, 'demo_' + o.id, url, o.x, foot - h / 2 + b, h, false);
        }
        var ch = S.CHARACTERS && S.CHARACTERS[o.id];
        S.drawText(ctx, (ch && ch.name) || '', o.x, foot + 6, { size: 10, color: '#dff4ff', align: 'center' });
      }

    } else if (slide.kind === 'worlds') {
      S.drawText(ctx, 'さまざまな せかいが まっている！', VW / 2, 44, { size: 13, color: '#ffd76e', align: 'center', weight: 'bold' });
      var worlds = [
        { art: 'throwin_golem',   label: '🔥 ほのおの どうくつ', x: 78,  y: 140 },
        { art: 'ice_golem',       label: '❄️ こおりの とう',     x: 210, y: 140 },
        { art: 'forest_guardian', label: '🌿 もりの しんでん',   x: 78,  y: 252 },
        { art: 'dark_kaiser',     label: '👑 やみの しろ',       x: 210, y: 252 },
      ];
      for (var wi = 0; wi < worlds.length; wi++) {
        var w = worlds[wi];
        var art2 = S.ENEMY_ART && S.ENEMY_ART[w.art];
        if (art2 && typeof S.drawImageSprite === 'function') {
          S.drawImageSprite(ctx, 'demo_w' + wi, art2, w.x, w.y, 76, false);
        }
        S.drawText(ctx, w.label, w.x, w.y + 44, { size: 10, color: '#eaf2ff', align: 'center' });
      }

    } else if (slide.kind === 'cta') {
      S.drawText(ctx, 'いま、ぼうけんが はじまる！', VW / 2, 96, { size: 16, color: '#ffe89a', align: 'center', weight: 'bold', shadow: true });
      var pumpSize = 15 + 1.8 * Math.sin(_time * 4);
      S.drawText(ctx, '▶ ボタンを おして スタート！', VW / 2, 150, { size: pumpSize, color: '#ffd24a', align: 'center', weight: 'bold', shadow: true });
      var mini = ['aoshi', 'ikuma', 'yuito', 'tomoki', 'itsuki'];
      for (var mi2 = 0; mi2 < mini.length; mi2++) {
        var mx = 44 + mi2 * 50;
        var url2 = S.ALLY_ART && S.ALLY_ART[mini[mi2]];
        if (url2 && typeof S.drawImageSprite === 'function') {
          S.drawImageSprite(ctx, 'demo_cta' + mi2, url2, mx, 288, 84, false);
        }
      }
    }

    ctx.restore(); // フェード終わり

    // ── スライド位置ドット（つねに表示） ──
    var dotY = 336, dn = _DEMO.length, dGap = 12, dx0 = VW / 2 - (dn - 1) * dGap / 2;
    for (var d = 0; d < dn; d++) {
      ctx.fillStyle = (d === at.i) ? '#ffd76e' : 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.arc(dx0 + d * dGap, dotY, (d === at.i) ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 「なにか おすと タイトルへ」＋左上 DEMO バッジ（点滅） ──
    if (Math.floor(_time / 0.5) % 2 === 0) {
      S.drawText(ctx, '▶ ボタンを おすと タイトルへ', VW / 2, 350, { size: 10, color: '#cfe0ff', align: 'center' });
    }
    S.drawText(ctx, 'DEMO', 8, 8, { size: 11, color: '#ff9ab0', align: 'left', weight: 'bold' });
  }

  // ── ⑥ おまかせ盛り：スタジアムの お祝い花火（ゆうしょうの うちあげ花火） ──
  //   夜空に ときどき うちあがって パッと ひらく＝「もっと豪華に」の しあげ。
  //   状態も 関数も すべて createTitleScene() クロージャ内＝バンドル鉄則①（トップレベル衝突ゼロ）。
  //   VW/VH は draw ローカルなので、ここでは window.SRPG から都度とる。
  var _fw       = [];   // うちあげ中の花火（rise＝のぼる → burst＝ひらく）
  var _fwTimer  = 1.2;  // つぎの うちあげまでの カウントダウン（秒）
  var _FW_COLORS = ['#ffe89a', '#ff9ec6', '#9ad2ff', '#b6ff9a', '#fff2c0', '#ffb35c'];

  function _spawnFirework() {
    var S = (typeof window !== 'undefined') ? window.SRPG : null;
    var vw = (S && S.VW) || 288;
    var cx  = 26 + Math.random() * (vw - 52);       // よこの うちあげ位置
    var top = 30 + Math.random() * 78;              // ひらく たかさ（空の上のほう）
    var col = _FW_COLORS[Math.floor(Math.random() * _FW_COLORS.length)];
    _fw.push({ phase: 'rise', x: cx, y: 232, targetY: top, vy: -(150 + Math.random() * 46),
               col: col, t: 0, bx: cx, by: top, parts: null });
  }

  function _stepFireworks(dt) {
    _fwTimer -= dt;
    if (_fwTimer <= 0) { _spawnFirework(); _fwTimer = 0.8 + Math.random() * 1.2; }
    for (var i = _fw.length - 1; i >= 0; i--) {
      var s = _fw[i];
      if (s.phase === 'rise') {
        s.y += s.vy * dt;
        if (s.y <= s.targetY) {                     // てっぺんで ひらく
          s.phase = 'burst'; s.t = 0; s.bx = s.x; s.by = s.y; s.parts = [];
          // 二重リング（そと＝はやい／うち＝ゆっくり）＝ほんものの 星形しゃげき玉ふう
          var _rings = [ { n: 18, sp0: 52, sp1: 42 }, { n: 10, sp0: 24, sp1: 22 } ];
          for (var rg = 0; rg < _rings.length; rg++) {
            var R = _rings[rg];
            for (var k = 0; k < R.n; k++) {
              var ang = (k / R.n) * Math.PI * 2 + rg * 0.32;
              var sp  = R.sp0 + Math.random() * R.sp1;
              s.parts.push({ x: s.x, y: s.y, px: s.x, py: s.y,
                             vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp });
            }
          }
        }
      } else {
        s.t += dt;
        for (var p = 0; p < s.parts.length; p++) {
          var pt = s.parts[p];
          pt.px = pt.x; pt.py = pt.y;             // 尾を ひくため 前の位置をおぼえる
          pt.x += pt.vx * dt; pt.y += pt.vy * dt;
          pt.vy += 40 * dt;   // じゅうりょくで だんだん おちる
          pt.vx *= 0.985;     // くうきていこう
        }
        if (s.t > 1.35) _fw.splice(i, 1);           // きえたら さくじょ
      }
    }
    if (_fw.length > 6) _fw.splice(0, _fw.length - 6); // 上限（描画負荷ガード）
  }

  function _drawFireworks(ctx) {
    for (var i = 0; i < _fw.length; i++) {
      var s = _fw[i];
      if (s.phase === 'rise') {
        // のぼる ひかりの お（尾）
        ctx.save();
        ctx.globalAlpha = 0.9; ctx.fillStyle = s.col;
        ctx.fillRect(s.x - 1, s.y - 2, 2, 6);
        ctx.globalAlpha = 0.3;
        ctx.fillRect(s.x - 1, s.y + 5, 2, 7);
        ctx.restore();
      } else {
        var fade = Math.max(0, 1 - s.t / 1.35);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';   // 加算合成＝ひかりが かさなって まぶしく
        // ひらいた しゅんかんの 色つき＋白い フラッシュ
        if (s.t < 0.22) {
          var fa = 1 - s.t / 0.22;
          ctx.globalAlpha = fa * 0.6; ctx.fillStyle = s.col;
          ctx.beginPath(); ctx.arc(s.bx, s.by, 6 + s.t * 70, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = fa * 0.9; ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(s.bx, s.by, 3 + s.t * 34, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = s.col; ctx.strokeStyle = s.col;
        ctx.lineWidth = 1.3 * fade + 0.5;
        for (var p = 0; p < s.parts.length; p++) {
          var pt = s.parts[p];
          var tw = 0.55 + 0.45 * Math.sin(s.t * 22 + p);  // きらめき
          ctx.globalAlpha = fade * tw;
          ctx.beginPath(); ctx.moveTo(pt.px, pt.py); ctx.lineTo(pt.x, pt.y); ctx.stroke(); // ひかりの尾
          var r = 1.8 * fade + 0.7;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill();             // 玉
        }
        ctx.restore();
      }
    }
  }

  return {
    update: function (dt, input) {
      _time += dt;
      if (_mode !== 'demo') _stepFireworks(dt); // デモ中は デモが 画面を のっとる
      // タイトルBGMを毎フレーム保証（同じ曲なら即 return＝軽い）。入力が無い
      // フレームでも鳴らしたいので、早期 return より前で呼ぶ。
      if (typeof window !== 'undefined' && window.SRPG && window.SRPG.playBgm) {
        window.SRPG.playBgm('title');
      }

      // ── アトラクトモード（オープニングデモ）の制御 ──
      //   main で むそうさが つづくと デモを ながし、なにか おされたら すぐ タイトルへ もどる。
      //   pressed は 毎フレーム オブジェクトで来る（各キーはエッジ検出のブール）ので、
      //   「どれか 新規押下されたフレームか」で アイドルを 判定する。
      var _pr0 = input && input.pressed;
      var _anyPress = !!(_pr0 && (_pr0.up || _pr0.down || _pr0.left || _pr0.right || _pr0.confirm || _pr0.cancel));
      if (_mode === 'demo') {
        _demoT += dt;
        if (_anyPress || _demoT >= _demoTotal()) { _mode = 'main'; _idle = 0; _demoT = 0; }
        return; // デモ中は通常のメニュー操作をしない（押したら もどるだけ）
      }
      if (_mode === 'main') {
        if (_anyPress) { _idle = 0; }
        else {
          _idle += dt;
          if (_idle >= _IDLE_LIMIT) { _mode = 'demo'; _demoT = 0; _idle = 0; }
        }
      } else {
        _idle = 0; // サブメニュー（難易度/ずかん/りれき）中は アイドル計測しない
      }

      if (!input || !input.pressed) return;
      var pr = input.pressed;
      var S = (typeof window !== 'undefined') ? window.SRPG : null;

      // ── 難易度選択モード ──
      if (_mode === 'difficulty') {
        if (pr.up)   _diffCursor = (_diffCursor - 1 + DIFFS.length) % DIFFS.length;
        if (pr.down) _diffCursor = (_diffCursor + 1) % DIFFS.length;
        if (pr.cancel) { _mode = 'main'; return; }
        if (pr.confirm && S) { _beginNewGame(S, DIFFS[_diffCursor].v); }
        return;
      }

      // ── なかま ずかん モード ──
      if (_mode === 'chars') {
        var n = _ZUKAN_IDS.length;
        if (pr.left || pr.up)    _charCursor = (_charCursor - 1 + n) % n;
        if (pr.right || pr.down) _charCursor = (_charCursor + 1) % n;
        if (pr.cancel) { _mode = 'main'; }
        return;
      }

      // ── こうしんりれき モード ──（上下でスクロール、もどるでタイトルへ）
      if (_mode === 'changelog') {
        if (pr.up)   _clScroll -= 28;
        if (pr.down) _clScroll += 28;
        if (_clScroll < 0) _clScroll = 0; // 上限は draw 側で内容量に応じてクランプ
        if (pr.cancel) { _mode = 'main'; }
        return;
      }

      var selectable = _selectableItems();

      // 上下でカーソル移動（選択可能項目だけを巡回）
      if (pr.up || pr.down) {
        var idx = selectable.indexOf(_cursor);
        if (pr.down) idx = (idx + 1) % selectable.length;
        if (pr.up)   idx = (idx - 1 + selectable.length) % selectable.length;
        _cursor = selectable[idx];
      }

      // 決定
      if (pr.confirm) {
        if (!S) return;

        if (_cursor === 0) {
          // はじめから → 難易度選択へ
          _mode = 'difficulty';
          _diffCursor = 1;

        } else if (_cursor === 1) {
          // つづきから
          var saved = S.loadGame();
          if (saved) {
            _startGame(saved);
          }

        } else if (_cursor === 2) {
          // つよくてニューゲーム（クリア済みセーブのみ選べる）
          _beginNewGamePlus(S);

        } else if (_cursor === 3) {
          // なかま ずかん
          _mode = 'chars';
          _charCursor = 0;

        } else if (_cursor === 4) {
          // こうしんりれき
          _mode = 'changelog';
          _clScroll = 0;
        }
      }
    },

    draw: function (ctx) {
      var S = (typeof window !== 'undefined') ? window.SRPG : null;
      if (!S) return;
      var VW = S.VW;
      var VH = S.VH;

      // オープニングデモ中は 専用ムービーを描く（アトラクトモード）
      if (_mode === 'demo') { _drawDemo(ctx, S, VW, VH); return; }

      // ════════════════════════════════════════════════════════════
      //  ナイタースタジアム演出（夜空→観客席→ピッチ＋投光器＋黄金ボール）
      // ════════════════════════════════════════════════════════════
      var pitchTop = 250;  // ピッチ上端（ヒーローが立つ芝の上端）

      // ── 1. 夜空グラデ（上＝暗い、地平線＝うっすら明るい） ──────────
      var sky = ctx.createLinearGradient(0, 0, 0, pitchTop);
      sky.addColorStop(0,   '#05070f');
      sky.addColorStop(0.55, '#0a1430');
      sky.addColorStop(1,   '#17294e');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, VW, pitchTop);

      // ── 2. 投光器（左右上から光のグロー＋ピッチへ ゆっくり振れる光芒） ──
      //   swayPhase を左右で逆にして、本物のサーチライトのように交差させる。
      function floodlight(fx, swayPhase) {
        var g = ctx.createRadialGradient(fx, 22, 2, fx, 22, 72);
        g.addColorStop(0,   'rgba(224,238,255,0.55)');
        g.addColorStop(0.3, 'rgba(150,190,255,0.18)');
        g.addColorStop(1,   'rgba(150,190,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(fx - 72, 0, 144, 150);
        // 光芒（ピッチ中央へ・左右にゆっくりスイング＋明るさ脈動）
        var sway      = Math.sin(_time * 0.85 + swayPhase) * 32;               // 振れ幅 ±32px
        var beamAlpha = 0.06 + 0.035 * (0.5 + 0.5 * Math.sin(_time * 1.3 + swayPhase));
        ctx.save();
        ctx.globalAlpha = beamAlpha;
        ctx.fillStyle = '#bcd4ff';
        ctx.beginPath();
        ctx.moveTo(fx - 6, 18); ctx.lineTo(fx + 6, 18);
        ctx.lineTo(VW / 2 + 46 + sway, pitchTop); ctx.lineTo(VW / 2 - 46 + sway, pitchTop);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        // ランプ
        ctx.fillStyle = '#eef5ff';
        ctx.beginPath(); ctx.arc(fx, 22, 4, 0, Math.PI * 2); ctx.fill();
      }
      floodlight(40, 0);
      floodlight(VW - 40, Math.PI);

      // ── 3. 瞬く星（_time で明滅・固定位置） ───────────────────────
      var stars = [
        [30,20],[80,40],[150,15],[220,35],[260,18],
        [50,60],[190,55],[240,70],[100,80],[170,90],
        [20,100],[270,105],[140,48],[60,128],[205,118],
      ];
      for (var si = 0; si < stars.length; si++) {
        var tw = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(_time * 2.2 + si * 1.3));
        ctx.fillStyle = 'rgba(255,255,255,' + tw.toFixed(3) + ')';
        var sz = (si % 3 === 0) ? 2 : 1;
        ctx.fillRect(stars[si][0], stars[si][1], sz, sz);
      }

      // ── 3.5 スタジアムの お祝い花火（星の うしろの 夜空に ひらく） ──
      _drawFireworks(ctx);

      // ── 4. 観客席のシルエット＋まばらな観客の灯り ────────────────
      ctx.fillStyle = '#0a1326';
      ctx.fillRect(0, pitchTop - 22, VW, 22);
      for (var cs = 0; cs < 44; cs++) {
        var cxp = (cs * 37 + 13) % VW;
        var cyp = pitchTop - 20 + ((cs * 7) % 16);
        ctx.fillStyle = (cs % 4 === 0) ? 'rgba(255,220,150,0.5)' : 'rgba(180,200,255,0.32)';
        ctx.fillRect(cxp, cyp, 1, 1);
      }

      // ── 5. ピッチ（芝グラデ＋刈り込みストライプ＋ライン） ─────────
      var pitch = ctx.createLinearGradient(0, pitchTop, 0, VH);
      pitch.addColorStop(0, '#1d6b34');
      pitch.addColorStop(1, '#0b3a1b');
      ctx.fillStyle = pitch;
      ctx.fillRect(0, pitchTop, VW, VH - pitchTop);
      for (var ps = 0; ps < 6; ps += 2) {
        var y0 = pitchTop + (VH - pitchTop) * (ps / 6);
        var y1 = pitchTop + (VH - pitchTop) * ((ps + 1) / 6);
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(0, y0, VW, y1 - y0);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, pitchTop + 1); ctx.lineTo(VW, pitchTop + 1); ctx.stroke();
      if (ctx.ellipse) {
        ctx.beginPath(); ctx.ellipse(VW / 2, pitchTop + 1, 46, 14, 0, 0, Math.PI * 2); ctx.stroke();
      }

      // ── 6. カイザーの影（チームの背後に ぬっと立ち上がる ラスボス） ──
      //   仲間より一回り大きく・足元を下げて頭を高く＝頭とマントが
      //   ユイトの上／キャラの隙間から覗く＝「勢ぞろい」の圧を出す。
      //   alpha を脈動させて生き物感、赤紫オーラで禍々しさ。
      (function () {
        var kx = VW / 2, kFoot = 268, kH = 208;   // 大きく＆足元を下げ→頭が高く出る
        var kCy = kFoot - kH / 2;
        var pulse = 0.5 + 0.5 * Math.sin(_time * 1.6);
        // 禍々しい赤紫オーラ（ゆっくり脈動・胴のあたりを中心に）
        var auraCy = kFoot - kH * 0.5;
        var aura = ctx.createRadialGradient(kx, auraCy, 8, kx, auraCy, 128 + pulse * 16);
        aura.addColorStop(0,   'rgba(170,34,82,' + (0.24 + pulse * 0.13).toFixed(3) + ')');
        aura.addColorStop(0.5, 'rgba(90,24,104,0.14)');
        aura.addColorStop(1,   'rgba(90,24,104,0)');
        ctx.fillStyle = aura;
        ctx.fillRect(kx - 140, kFoot - kH - 20, 280, kH + 52);
        // カイザー本体を影として（暗く沈めて背後に君臨させる）
        var kart = S.ENEMY_ART && S.ENEMY_ART.dark_kaiser;
        if (kart && typeof S.drawImageSprite === 'function') {
          ctx.save();
          ctx.globalAlpha = 0.42 + pulse * 0.07;
          S.drawImageSprite(ctx, 'title_kaiser', kart, kx, kCy, kH, false);
          ctx.restore();
        }
      })();

      // ── 7. なかまたち 勢ぞろい（中央ユイト＋左右に4人・遠近つき） ────
      //   外側ほど小さく＆やや高く＝奥行き。足元はメニュー窓の上端あたりで、
      //   すねから下は窓の裏へ。ふわふわ＝cy を time で微揺らし（位相ずらし）。
      // ステージ中央の照明グロー（5人をまとめて照らす）
      var stageGlow = ctx.createRadialGradient(VW / 2, 244, 8, VW / 2, 244, 118);
      stageGlow.addColorStop(0, 'rgba(255,244,206,0.20)');
      stageGlow.addColorStop(1, 'rgba(255,244,206,0)');
      ctx.fillStyle = stageGlow;
      ctx.fillRect(VW / 2 - 120, 150, 240, 150);

      // 描画順＝奥（小）→ 手前（大）。ユイトが最後＝最前面。
      var party = [
        { id: 'aoshi',  cx: 40,  foot: 246, h: 104, ph: 0.0, flip: false },
        { id: 'itsuki', cx: 248, foot: 246, h: 104, ph: 1.1, flip: false },
        { id: 'ikuma',  cx: 92,  foot: 256, h: 120, ph: 2.2, flip: false },
        { id: 'tomoki', cx: 196, foot: 256, h: 120, ph: 3.3, flip: false },
        { id: 'yuito',  cx: 144, foot: 268, h: 144, ph: 0.6, flip: false },
      ];
      var allyArt = S.ALLY_ART || null;
      for (var pi = 0; pi < party.length; pi++) {
        var mem  = party[pi];
        var bob  = Math.sin(_time * 1.8 + mem.ph) * 2.4;   // ふわふわ上下
        var foot = mem.foot + bob;
        S.drawShadow(ctx, mem.cx, foot - 4, mem.h * 0.24, mem.h * 0.055);
        var url  = allyArt && allyArt[mem.id];
        var drew = false;
        if (url && typeof S.drawImageSprite === 'function') {
          drew = S.drawImageSprite(ctx, 'title_' + mem.id, url, mem.cx, foot - mem.h / 2, mem.h, mem.flip);
        }
        if (!drew && S.SPRITES && S.SPRITES[mem.id]) {
          var fsp = S.SPRITES[mem.id], fsc = 4;
          var fw = fsp.map[0].length * fsc, fh = fsp.map.length * fsc;
          S.drawSprite(ctx, fsp, Math.floor(mem.cx - fw / 2), Math.floor(foot - fh), fsc);
        }
      }

      // ── 7.5 きらきら光の粒（舞い上がる魔法の粒子）＋ 黄金ボールの煌めき ──
      //   Math.random は使えない（決定論）ので index と _time から位置を作る。
      (function () {
        // 4方向にとがる「きらめき星」を1つ描く小ヘルパ
        function twinkle(x, y, r, a, col) {
          if (a <= 0 || r <= 0) return;
          ctx.save();
          ctx.globalAlpha = a;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.28, y - r * 0.28);
          ctx.lineTo(x + r, y); ctx.lineTo(x + r * 0.28, y + r * 0.28);
          ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.28, y + r * 0.28);
          ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.28, y - r * 0.28);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }

        // (A) 舞い上がる光の粒（ゆっくり上昇＆点滅しながらループ）
        var N = 16;
        for (var i = 0; i < N; i++) {
          var bx    = (((i * 61.8) % 100) / 100) * VW;            // 横は index から散らす
          var speed = 0.05 + (i % 5) * 0.014;
          var prog  = ((_time * speed + i * 0.137) % 1);           // 0..1 でループ
          var py    = 300 - prog * 300;                            // 下(300)→上(0)へ
          var pr    = 1.4 + (i % 3) * 0.6;
          var flick = 0.5 + 0.5 * Math.sin(_time * 3 + i * 1.7);   // ちらつき
          var fade  = Math.sin(prog * Math.PI);                    // 端でフェード
          var col   = (i % 4 === 0) ? '#ffe89a' : '#dff0ff';       // 金 or 白青
          twinkle(bx, py, pr, 0.5 * flick * fade, col);
        }

        // (B) 黄金ボールの煌めき（ユイトが掲げる金ボールの周りで星がまたたく）
        //   ユイトのふわふわ(bob)に追従させる＝ボールに張り付いて見える。
        var yuitoBob = Math.sin(_time * 1.8 + 0.6) * 2.4;
        var ballX = 157, ballY = 206 + yuitoBob;
        var glints = [[ballX, ballY, 0.0], [ballX + 12, ballY - 9, 1.6], [ballX - 11, ballY + 7, 3.1]];
        for (var gi = 0; gi < glints.length; gi++) {
          var gph = glints[gi][2];
          var ga  = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(_time * 4 + gph));
          var gr  = 3 + 2 * (0.5 + 0.5 * Math.sin(_time * 4 + gph));
          twinkle(glints[gi][0], glints[gi][1], gr, ga, '#fff3c0');
        }
      })();

      // ── 7. タイトルロゴ（発光＝外側グロー＋くっきり金文字） ────────
      var logoY = 44;
      ctx.save();
      ctx.shadowColor = 'rgba(255,176,42,0.85)';
      ctx.shadowBlur  = 14 + 5 * Math.sin(_time * 2.4);
      S.drawText(ctx, 'ユイトと黄金の', VW / 2, logoY,      { size: 26, color: '#ffe89a', align: 'center', weight: 'bold' });
      S.drawText(ctx, 'サッカーボール', VW / 2, logoY + 34, { size: 26, color: '#ffe89a', align: 'center', weight: 'bold' });
      ctx.restore();
      S.drawText(ctx, 'ユイトと黄金の', VW / 2, logoY,      { size: 26, color: '#ffd24a', align: 'center', weight: 'bold', shadow: true });
      S.drawText(ctx, 'サッカーボール', VW / 2, logoY + 34, { size: 26, color: '#ffd24a', align: 'center', weight: 'bold', shadow: true });
      // サブタイトル
      S.drawText(ctx, 'こがねの ボールを とりもどせ！', VW / 2, logoY + 64, {
        size: 12, color: '#cfe0ff', align: 'center',
      });

      // ── 8. メニュー ───────────────────────────────────────────────
      //   画面下の操作ボタン（y357〜）より上に収める。
      if (_mode === 'chars') {
        // ── なかま ずかん（キャラ紹介） ──
        _drawZukan(ctx, S, VW);
      } else if (_mode === 'changelog') {
        // ── こうしんりれき（更新履歴） ──
        _drawChangelog(ctx, S, VW);
      } else if (_mode === 'difficulty') {
        // ── 難易度選択サブメニュー ──
        S.drawWindow(ctx, VW / 2 - 116, 232, 232, 120, {
          radius: 10,
          border: '#c89a4a',
        });
        S.drawText(ctx, 'なんいど を えらぶ', VW / 2, 248, {
          size: 13, color: '#ffd76e', align: 'center', weight: 'bold',
        });
        for (var di = 0; di < DIFFS.length; di++) {
          var dItemY  = 272 + di * 22;
          var dSelected = _diffCursor === di;
          var dColor  = dSelected ? '#ffffff' : '#dff4ff';
          if (dSelected) {
            var dBlink = Math.floor(_time / 0.5) % 2 === 0;
            if (dBlink) {
              S.drawText(ctx, '▶', VW / 2 - 78, dItemY + 2, {
                size: 14, color: '#ffd76e', align: 'left',
              });
            }
          }
          S.drawText(ctx, DIFFS[di].label, VW / 2, dItemY, {
            size: 16, color: dColor, align: 'center', shadow: dSelected,
          });
        }
        // フォーカス中の難易度の説明
        S.drawText(ctx, DIFFS[_diffCursor].desc, VW / 2, 340, {
          size: 9, color: '#cfe0ff', align: 'center',
        });
      } else {
        // ── メインメニュー（はじめから／つづきから／つよくてニューゲーム／なかま ずかん） ──
        var hasSave = typeof S.hasSave === 'function' && S.hasSave();
        var cleared = hasSave && _hasClearedSave();
        var menuItems  = [{ label: 'はじめから', idx: 0 }];
        if (hasSave) {
          menuItems.push({ label: 'つづきから', idx: 1 });
          if (cleared) menuItems.push({ label: 'つよくてニューゲーム', idx: 2 });
        }
        menuItems.push({ label: 'なかま ずかん', idx: 3 });   // いつでも見られる
        menuItems.push({ label: 'こうしんりれき', idx: 4 }); // いつでも見られる

        // 項目数(n)に応じてレイアウトを変える。長いラベル（つよくてNG+）が出る
        // クリア後は窓を広く。バーチャルパッド（y357〜）に被らないよう下端は 357 より上。
        var n          = menuItems.length;
        var gap        = n >= 5 ? 21 : (n >= 4 ? 24 : (n === 3 ? 28 : 34));
        var fontSize   = n >= 5 ? 13 : (n >= 4 ? 14 : (n === 3 ? 15 : 18));
        var menuStartY = n >= 5 ? 242 : (n >= 4 ? 250 : (n === 3 ? 264 : 280));
        var winW       = cleared ? 224 : 200;
        var winH       = n * gap + 16;
        var arrowX     = VW / 2 - winW / 2 + 10;

        // メニュー背景ウィンドウ（金枠）
        S.drawWindow(ctx, VW / 2 - winW / 2, menuStartY - 12, winW, winH, {
          radius: 10,
          border: '#c89a4a',
        });

        for (var mi = 0; mi < menuItems.length; mi++) {
          var item  = menuItems[mi];
          var itemY = menuStartY + mi * gap;
          var isSelected = _cursor === item.idx;
          var isEnabled  = (item.idx === 0 || item.idx === 3 || item.idx === 4) || hasSave; // つづき/つよくてNG+ はセーブが要る（ずかん・こうしんりれきは常時OK）

          var color = isEnabled ? '#dff4ff' : '#556677';
          if (isSelected && isEnabled) color = '#ffffff';

          if (isSelected && isEnabled) {
            var blink = Math.floor(_time / 0.5) % 2 === 0;
            if (blink) {
              S.drawText(ctx, '▶', arrowX, itemY + 2, {
                size: fontSize - 2, color: '#ffd76e', align: 'left',
              });
            }
          }

          S.drawText(ctx, item.label, VW / 2, itemY, {
            size: fontSize, color: color, align: 'center', shadow: isSelected && isEnabled,
          });
        }
      }

      // ── 9. バージョン表示 ─────────────────────────────────────────
      S.drawText(ctx, 'ver 0.1', 4, VH - 18, {
        size: 10, color: '#67809e', align: 'left',
      });
    },
  };
}

// ── UMD エクスポート ────────────────────────────────────────────────
(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  createTitleScene: createTitleScene,
});
