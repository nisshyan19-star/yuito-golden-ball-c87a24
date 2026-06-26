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
  // 選択項目: 0=はじめから, 1=つづきから
  var _cursor = 0; // 現在のカーソル位置
  var _time   = 0; // アニメーション用タイマー

  // 選択可能な項目インデックスの配列を動的に返す（セーブ無しは「はじめから」のみ）
  function _selectableItems() {
    var S = (typeof window !== 'undefined') ? window.SRPG : null;
    var hasSave = S && typeof S.hasSave === 'function' && S.hasSave();
    return hasSave ? [0, 1] : [0];
  }

  return {
    update: function (dt, input) {
      _time += dt;
      if (!input || !input.pressed) return;
      var pr = input.pressed;
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
        var S = (typeof window !== 'undefined') ? window.SRPG : null;
        if (!S) return;

        if (_cursor === 0) {
          // はじめから
          var newState = S.createNewGame();
          S.saveGame(newState);
          // 導入ダイアログを push（onComplete でゲーム開始）
          S.pushScene(S.createDialog(
            [
              'ユイトは サッカーが だいすきな 9さいの しょうねん。',
              'ある日、町の たからもの「黄金のサッカーボール」が ぬすまれた！',
              'ユイトの ぼうけんが はじまる！',
            ],
            {
              onComplete: function () { _startGame(newState); },
            }
          ));

        } else if (_cursor === 1) {
          // つづきから
          var saved = S.loadGame();
          if (saved) {
            _startGame(saved);
          }
        }
      }
    },

    draw: function (ctx) {
      var S = (typeof window !== 'undefined') ? window.SRPG : null;
      if (!S) return;
      var VW = S.VW;
      var VH = S.VH;

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

      // ── 2. 投光器（左右上から光のグロー＋ピッチへ伸びる光芒） ──────
      function floodlight(fx) {
        var g = ctx.createRadialGradient(fx, 22, 2, fx, 22, 72);
        g.addColorStop(0,   'rgba(224,238,255,0.55)');
        g.addColorStop(0.3, 'rgba(150,190,255,0.18)');
        g.addColorStop(1,   'rgba(150,190,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(fx - 72, 0, 144, 150);
        // 光芒（ピッチ中央へ）
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#bcd4ff';
        ctx.beginPath();
        ctx.moveTo(fx - 6, 18); ctx.lineTo(fx + 6, 18);
        ctx.lineTo(VW / 2 + 46, pitchTop); ctx.lineTo(VW / 2 - 46, pitchTop);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        // ランプ
        ctx.fillStyle = '#eef5ff';
        ctx.beginPath(); ctx.arc(fx, 22, 4, 0, Math.PI * 2); ctx.fill();
      }
      floodlight(40);
      floodlight(VW - 40);

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

      // ── 6. ヒーロー（ユイト）を立たせる ───────────────────────────
      //   メニュー窓（後で描く＝y268〜348）の上に立ち、すねから下は窓の裏へ。
      //   立ち絵自体が黄金ボールを掲げているので別途ボールは描かない。
      var heroBottom = 300;
      var heroBoxH   = 184;
      // スポットライト（足元の地面グロー）
      var sg = ctx.createRadialGradient(VW / 2, heroBottom - 16, 4, VW / 2, heroBottom - 16, 98);
      sg.addColorStop(0, 'rgba(255,242,200,0.22)');
      sg.addColorStop(1, 'rgba(255,242,200,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(VW / 2 - 98, heroBottom - 96, 196, 140);
      // 影
      S.drawShadow(ctx, VW / 2, heroBottom - 6, 34, 8);
      // AI立ち絵（在れば）→ 無ければドット絵へフォールバック
      var allyArt = S.ALLY_ART || null;
      var heroUrl = allyArt && allyArt.yuito;
      var drewHero = false;
      if (heroUrl && typeof S.drawImageSprite === 'function') {
        drewHero = S.drawImageSprite(ctx, 'title_hero', heroUrl, VW / 2, heroBottom - heroBoxH / 2, heroBoxH, false);
      }
      if (!drewHero && S.SPRITES && S.SPRITES.yuito) {
        var sp = S.SPRITES.yuito;
        var sc = 6;
        var w = sp.map[0].length * sc, h = sp.map.length * sc;
        // フォールバック時はメニュー窓の上端（268）より上に立たせる
        S.drawSprite(ctx, sp, Math.floor((VW - w) / 2), 258 - h, sc);
      }

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
      //   画面下の操作ボタン（y357〜）より上に収める＝窓は y268〜348。
      var menuStartY = 280;
      var menuItems  = [
        { label: 'はじめから', idx: 0 },
        { label: 'つづきから', idx: 1 },
      ];
      var hasSave = typeof S.hasSave === 'function' && S.hasSave();

      // メニュー背景ウィンドウ（金枠）
      S.drawWindow(ctx, VW / 2 - 80, menuStartY - 12, 160, 80, {
        radius: 10,
        border: '#c89a4a',
      });

      for (var mi = 0; mi < menuItems.length; mi++) {
        var item  = menuItems[mi];
        var itemY = menuStartY + mi * 36;
        var isSelected = _cursor === item.idx;
        var isEnabled  = (item.idx === 0) || hasSave;

        var color = isEnabled ? '#dff4ff' : '#556677';
        if (isSelected && isEnabled) color = '#ffffff';

        if (isSelected && isEnabled) {
          var blink = Math.floor(_time / 0.5) % 2 === 0;
          if (blink) {
            S.drawText(ctx, '▶', VW / 2 - 56, itemY + 2, {
              size: 16, color: '#ffd76e', align: 'left',
            });
          }
        }

        S.drawText(ctx, item.label, VW / 2, itemY, {
          size: 18, color: color, align: 'center', shadow: isSelected && isEnabled,
        });
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
