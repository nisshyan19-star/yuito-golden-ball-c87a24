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

    // タイトル画面からゲームを開始する（Task9 〜）
    S.pushScene(S.createTitleScene());

    var last = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();

    function frame(now) {
      var dt = (now - last) / 1000;
      if (dt > 0.1) dt = 0.1; // 大きなフレーム飛びを抑制
      last = now;

      var input = S.pollInput();

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
