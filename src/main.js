// === main.js ===
// 起動エントリ。window がある時だけ動く（Node で読まれても副作用ゼロ）。
// canvas#game → initCanvas → initInput → タイトルシーン push → rAF ループ。

(function () {
  if (typeof window === 'undefined') return; // Node では何もしない

  function start() {
    var S = window.SRPG;
    var canvas = document.getElementById('game');
    if (!canvas) {
      console.error('[main] canvas#game が見つかりません');
      return;
    }

    S.initCanvas(canvas);
    S.initInput(canvas);
    if (S.initAudio) S.initAudio(); // 効果音の初期化（最初の操作で音が解錠される）

    // タイトル画面からゲームを開始する（Task9 〜）
    S.pushScene(S.createTitleScene());

    var last = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();

    function frame(now) {
      var dt = (now - last) / 1000;
      if (dt > 0.1) dt = 0.1; // 大きなフレーム飛びを抑制
      last = now;

      var input = S.pollInput();

      // 効果音：確定/キャンセル/カーソル移動を1か所で鳴らす（UI操作の手応え）
      if (S.playSe && input && input.pressed) {
        if (input.pressed.confirm) S.playSe('confirm');
        else if (input.pressed.cancel) S.playSe('cancel');
        else if (input.pressed.up || input.pressed.down || input.pressed.left || input.pressed.right) S.playSe('move');
      }

      S.updateScenes(dt, input);

      var ctx = S.getCtx();
      if (ctx) {
        ctx.clearRect(0, 0, S.VW, S.VH);
        S.drawScenes(ctx);
        S.drawPad(ctx); // パッドは最前面
      }

      window.requestAnimationFrame(frame);
    }

    window.requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
