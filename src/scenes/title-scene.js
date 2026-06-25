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

      // ── 背景（濃紺グラデ） ─────────────────────────────────────────
      var grad = ctx.createLinearGradient(0, 0, 0, VH);
      grad.addColorStop(0, '#0a0e1c');
      grad.addColorStop(1, '#0e1830');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VW, VH);

      // ── 星の装飾（シンプルドット） ────────────────────────────────
      // 固定シードで擬似ランダムな星を描く（毎フレーム同じ位置）
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      var stars = [
        [30,20],[80,40],[150,15],[220,35],[260,18],
        [50,60],[190,55],[240,70],[100,80],[170,90],
        [20,100],[270,105],[140,50],[60,130],[200,120],
      ];
      for (var si = 0; si < stars.length; si++) {
        ctx.fillRect(stars[si][0], stars[si][1], 1, 1);
      }

      // ── タイトルロゴ ──────────────────────────────────────────────
      var logoY = 50;
      S.drawText(ctx, 'ユイトと黄金の', VW / 2, logoY, {
        size: 24, color: '#ffd76e', align: 'center', shadow: true, weight: 'bold',
      });
      S.drawText(ctx, 'サッカーボール', VW / 2, logoY + 32, {
        size: 24, color: '#ffd76e', align: 'center', shadow: true, weight: 'bold',
      });

      // ── ユイトのスプライト（ロゴ下） ──────────────────────────────
      if (S.SPRITES && S.SPRITES.yuito) {
        var spriteScale = 4;
        // スプライトのサイズ（16×16前提）でセンタリング
        var spriteW = S.SPRITES.yuito.map[0].length * spriteScale;
        var spriteX = Math.floor((VW - spriteW) / 2);
        var spriteY = logoY + 72;
        S.drawShadow(ctx, VW / 2, spriteY + S.SPRITES.yuito.map.length * spriteScale + 4, 20, 5);
        S.drawSprite(ctx, S.SPRITES.yuito, spriteX, spriteY, spriteScale);
      }

      // ── メニュー ──────────────────────────────────────────────────
      var menuStartY = 280;
      var menuItems  = [
        { label: 'はじめから', idx: 0 },
        { label: 'つづきから', idx: 1 },
      ];
      var hasSave = typeof S.hasSave === 'function' && S.hasSave();

      // メニュー背景ウィンドウ
      S.drawWindow(ctx, VW / 2 - 80, menuStartY - 12, 160, 80, {
        radius: 10,
        border: '#3a5a8a',
      });

      for (var mi = 0; mi < menuItems.length; mi++) {
        var item  = menuItems[mi];
        var itemY = menuStartY + mi * 36;
        var isSelected = _cursor === item.idx;
        var isEnabled  = (item.idx === 0) || hasSave;

        // テキスト色
        var color = isEnabled ? '#dff4ff' : '#556677';
        if (isSelected && isEnabled) color = '#ffffff';

        // カーソル（▶ または ハイライト）
        if (isSelected && isEnabled) {
          // 点滅カーソル
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

      // ── バージョン表示 ────────────────────────────────────────────
      S.drawText(ctx, 'ver 0.1', 4, VH - 20, {
        size: 10, color: '#445566', align: 'left',
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
