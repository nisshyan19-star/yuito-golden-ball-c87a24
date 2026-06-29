// === tournament-scene.js（追加弾5-C：サッカー トーナメント） ===
// PK戦を「攻撃3本＋守備3本」の1試合に拡張し、3チーム勝ち抜きの トーナメントを進行する。
// 判定は すべて S.* の純粋関数に委譲。描画は createPkScene と同じ ゴール枠＋3ゾーン方式。
function createTournamentScene(state, opts) {
  opts = opts || {};
  var S = (typeof window !== 'undefined' ? window : globalThis).SRPG;
  var VW = S.VW, VH = S.VH;
  var rng = (typeof opts.rng === 'function') ? opts.rng : Math.random;
  var KICKS = opts.kicksPerSide || 3;
  var SD_CAP = 5;

  var bracket = S.buildBracket();
  var roundIdx = 0;
  var team = bracket[roundIdx];

  var _phase = 'intro';
  var _timer = 0;
  var _done = false;
  var roundsWon = 0;

  // 攻撃
  var attackShot = 0, attackGoals = 0;
  var _shootDir = null, _keeperDir = null, _atkGoal = false;
  // 守備
  var defendShot = 0, defendSaves = 0;
  var _oppShotDir = null, _diveDir = null, _saved = false;
  // サドンデス
  var sdPair = 0, sdPlayerGoals = 0, sdOppGoals = 0;

  function _playerTotal() { return attackGoals + sdPlayerGoals; }
  // 相手の得点 = 守備本数(=KICKS, 攻守同数前提) − セーブ数 + サドンデス失点
  function _oppTotal() { return (KICKS - defendSaves) + sdOppGoals; }

  function _beginAttack() {
    _shootDir = null; _keeperDir = null; _atkGoal = false;
    sdPair = 0; sdPlayerGoals = 0; sdOppGoals = 0;
    attackShot = 0; attackGoals = 0; _phase = 'attack_aim';
  }
  function _beginDefend() {
    _diveDir = null; _saved = false;
    defendShot = 0; defendSaves = 0; _oppShotDir = S.opponentShotFor(team.skill, rng); _phase = 'defend_aim';
  }

  function _kick(dir) {
    _shootDir = dir;
    _keeperDir = S.keeperDiveFor(dir, team.skill, rng);
    _atkGoal = S.pkResolve(dir, _keeperDir);
    if (_atkGoal) attackGoals++;
    attackShot++;
    _phase = 'attack_result'; _timer = 0;
  }
  function _dive(dir) {
    _diveDir = dir;
    _saved = (dir === _oppShotDir);
    if (_saved) defendSaves++;
    defendShot++;
    _phase = 'defend_result'; _timer = 0;
  }

  function _sdKick(dir) {
    _shootDir = dir;
    _keeperDir = S.keeperDiveFor(dir, team.skill, rng);
    _atkGoal = S.pkResolve(dir, _keeperDir);
    if (_atkGoal) sdPlayerGoals++;
    _phase = 'sd_attack_result'; _timer = 0;
  }
  function _sdDive(dir) {
    _diveDir = dir;
    _saved = (dir === _oppShotDir);
    if (!_saved) sdOppGoals++;
    _phase = 'sd_defend_result'; _timer = 0;
  }

  function _decide(playerWon) {
    if (playerWon) {
      roundsWon++;
      if (roundIdx >= bracket.length - 1) { _phase = 'champion'; _timer = 0; }
      else { roundIdx++; team = bracket[roundIdx]; _phase = 'round_banner'; _timer = 0; }
    } else { _phase = 'lost'; _timer = 0; }
  }

  function _finish(champion) {
    if (_done) return;
    _done = true;
    S.popScene();
    if (typeof opts.onComplete === 'function') opts.onComplete(champion, roundsWon);
  }

  function _resultAdvance(dt, input) {
    // result系：1.1秒 or 0.5秒+なにかキー で先へ進む合図を返す
    _timer += dt;
    var pressed = (input && input.pressed) || {};
    var anyKey = pressed.confirm || pressed.cancel || pressed.left || pressed.right || pressed.up || pressed.down;
    return (_timer >= 1.1 || (_timer >= 0.5 && anyKey));
  }
  function _aimDir(pressed) {
    if (pressed.left) return 'left';
    if (pressed.right) return 'right';
    if (pressed.up || pressed.confirm) return 'center';
    return null;
  }

  function _zoneCenterX(dir) {
    var goalX = 44, goalW = VW - 88;
    if (dir === 'left') return goalX + goalW / 6;
    if (dir === 'right') return goalX + goalW * 5 / 6;
    return goalX + goalW / 2;
  }

  return {
    update: function (dt, input) {
      var pressed = (input && input.pressed) || {};
      switch (_phase) {
        case 'intro':
          if (pressed.confirm || pressed.up) _beginAttack();
          return;
        case 'attack_aim': {
          var d = _aimDir(pressed);
          if (d) _kick(d);
          return;
        }
        case 'attack_result':
          if (_resultAdvance(dt, input)) {
            if (attackShot >= KICKS) { _phase = 'defend_intro'; _timer = 0; }
            else { _phase = 'attack_aim'; }
          }
          return;
        case 'defend_intro':
          if (pressed.confirm || pressed.up) _beginDefend();
          return;
        case 'defend_aim': {
          var dd = _aimDir(pressed);
          if (dd) _dive(dd);
          return;
        }
        case 'defend_result':
          if (_resultAdvance(dt, input)) {
            if (defendShot >= KICKS) { _phase = 'match_done'; _timer = 0; }
            else { _oppShotDir = S.opponentShotFor(team.skill, rng); _phase = 'defend_aim'; }
          }
          return;
        case 'match_done':
          if (_resultAdvance(dt, input)) {
            var w = S.matchWinner(_playerTotal(), _oppTotal());
            if (w === 'draw') { sdPair = 0; sdPlayerGoals = 0; sdOppGoals = 0; _phase = 'sd_attack_aim'; }
            else _decide(w === 'player');
          }
          return;
        case 'round_banner':
          if (pressed.confirm || pressed.up) _beginAttack();
          return;
        case 'sd_attack_aim': {
          var sd = _aimDir(pressed);
          if (sd) _sdKick(sd);
          return;
        }
        case 'sd_attack_result':
          if (_resultAdvance(dt, input)) { _oppShotDir = S.opponentShotFor(team.skill, rng); _phase = 'sd_defend_aim'; }
          return;
        case 'sd_defend_aim': {
          var sdd = _aimDir(pressed);
          if (sdd) _sdDive(sdd);
          return;
        }
        case 'sd_defend_result':
          if (_resultAdvance(dt, input)) {
            sdPair++;
            var pt = _playerTotal(), ot = _oppTotal();
            if (pt !== ot) _decide(pt > ot);
            else if (sdPair >= SD_CAP) _decide(true); // 決着つかず＝子ども救済で プレイヤー勝ち
            else _phase = 'sd_attack_aim';
          }
          return;
        case 'champion':
          _timer += dt;
          if (_timer >= 0.4 && (pressed.confirm || pressed.cancel)) _finish(true);
          return;
        case 'lost':
          _timer += dt;
          if (_timer >= 0.4 && (pressed.confirm || pressed.cancel)) _finish(false);
          return;
        default:
          return;
      }
    },

    draw: function (ctx) {
      // 1. 背景（よるのスタジアム）
      var bg = ctx.createLinearGradient(0, 0, 0, VH);
      bg.addColorStop(0, '#0b1733'); bg.addColorStop(0.5, '#13245a'); bg.addColorStop(1, '#0a3d1f');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);

      // 2. タイトル＋ラウンド＋対戦相手
      S.drawWindow(ctx, VW / 2 - 96, 12, 192, 44, { radius: 8, border: '#ffd34d' });
      S.drawText(ctx, 'トーナメント', VW / 2, 19, { size: 14, color: '#ffe9a8', align: 'center' });
      S.drawText(ctx, team.round + '  vs ' + team.name, VW / 2, 39, { size: 12, color: team.color || '#dff4ff', align: 'center' });

      // 3. ゴール枠＋3ゾーン
      var goalX = 44, goalW = VW - 88, goalY = 120, goalH = 120;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.strokeRect(goalX, goalY, goalW, goalH);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
      for (var gi = 1; gi < 6; gi++) { var lx = goalX + (goalW / 6) * gi; ctx.beginPath(); ctx.moveTo(lx, goalY); ctx.lineTo(lx, goalY + goalH); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,211,77,0.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(goalX + goalW / 3, goalY); ctx.lineTo(goalX + goalW / 3, goalY + goalH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(goalX + goalW * 2 / 3, goalY); ctx.lineTo(goalX + goalW * 2 / 3, goalY + goalH); ctx.stroke();

      // 4. キーパー＆ボール
      var isAtkResult = (_phase === 'attack_result' || _phase === 'sd_attack_result');
      var isDefResult = (_phase === 'defend_result' || _phase === 'sd_defend_result');
      function drawKeeper(dir, color) {
        var kx = _zoneCenterX(dir), ky = goalY + goalH / 2;
        ctx.fillStyle = color; ctx.fillRect(kx - 12, ky - 14, 24, 36);
        ctx.fillStyle = '#ffd0b0'; ctx.beginPath(); ctx.arc(kx, ky - 22, 9, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(kx - 12, ky - 8); ctx.lineTo(kx - 26, ky - 20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(kx + 12, ky - 8); ctx.lineTo(kx + 26, ky - 20); ctx.stroke();
      }
      function drawBall(dir, scored) {
        var bx = _zoneCenterX(dir), by = scored ? (goalY + goalH * 0.32) : (goalY + goalH + 26);
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(bx, by, 10, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 10, 0, Math.PI * 2); ctx.stroke();
      }
      if (isAtkResult) { if (_keeperDir) drawKeeper(_keeperDir, team.color || '#ff5a5a'); if (_shootDir) drawBall(_shootDir, _atkGoal); }
      else if (isDefResult) { if (_diveDir) drawKeeper(_diveDir, '#5ec8ff'); if (_oppShotDir) drawBall(_oppShotDir, !_saved); }

      // 5. スコアボード（きみ 対 あいて）
      S.drawWindow(ctx, VW / 2 - 96, goalY + goalH + 36, 192, 30, { radius: 6, border: '#5ec8ff' });
      S.drawText(ctx, 'きみ ' + _playerTotal() + ' - ' + _oppTotal() + ' ' + team.name,
                 VW / 2, goalY + goalH + 44, { size: 12, color: '#dff4ff', align: 'center' });

      // 6. メッセージ窓
      var msgY = VH - 96;
      S.drawWindow(ctx, 12, msgY, VW - 24, 80, { radius: 8, border: '#ffd34d' });
      var line1 = '', line2 = '';
      switch (_phase) {
        case 'intro':
          line1 = team.round + '！ ' + team.name + ' との しあい！';
          line2 = 'まずは こうげき。けってい で スタート！'; break;
        case 'attack_aim':
          line1 = 'こうげき！ ' + (attackShot + 1) + '/' + KICKS + '本目 シュート！';
          line2 = '←ひだり  ↑/けってい=まんなか  →みぎ'; break;
        case 'attack_result':
          line1 = _atkGoal ? 'ゴール！！' : 'セーブ された…';
          line2 = _atkGoal ? 'ナイスシュート！' : 'つぎは コースを かえよう'; break;
        case 'defend_intro':
          line1 = 'こんどは キーパー！';
          line2 = 'あいての シュートを とめろ！ けってい で'; break;
        case 'defend_aim':
          line1 = 'しゅび！ ' + (defendShot + 1) + '/' + KICKS + '本目 とぶ ほうこう！';
          line2 = '←ひだり  ↑/けってい=まんなか  →みぎ'; break;
        case 'defend_result':
          line1 = _saved ? 'ナイスセーブ！！' : 'ゴールを きめられた…';
          line2 = _saved ? 'よく とめた！' : 'よみを かえてみよう'; break;
        case 'match_done':
          line1 = 'しあい しゅうりょう！  きみ ' + _playerTotal() + ' - ' + _oppTotal();
          line2 = 'けってい で つぎへ'; break;
        case 'round_banner':
          line1 = 'かった！ つぎは ' + team.round + ' ' + team.name + '！';
          line2 = 'けってい で しあい かいし'; break;
        case 'sd_attack_aim':
          line1 = 'サドンデス！ きみの シュート！';
          line2 = '←ひだり  ↑/けってい=まんなか  →みぎ'; break;
        case 'sd_attack_result':
          line1 = _atkGoal ? 'ゴール！！' : 'セーブ された…'; line2 = 'けってい で つぎへ'; break;
        case 'sd_defend_aim':
          line1 = 'サドンデス！ あいての シュートを とめろ！';
          line2 = '←ひだり  ↑/けってい=まんなか  →みぎ'; break;
        case 'sd_defend_result':
          line1 = _saved ? 'ナイスセーブ！！' : 'きめられた…'; line2 = 'けってい で つぎへ'; break;
        case 'champion':
          line1 = 'ゆうしょう！！  きみが チャンピオンだ！'; line2 = 'けってい/キャンセル で とじる'; break;
        case 'lost':
          line1 = team.name + 'に まけた…  ' + roundsWon + 'かいせん とっぱ'; line2 = 'けってい/キャンセル で とじる'; break;
        default: break;
      }
      var hot = (_atkGoal && isAtkResult) || (_saved && isDefResult) || _phase === 'champion';
      S.drawText(ctx, line1, VW / 2, msgY + 22, { size: 15, color: hot ? '#ffe9a8' : '#dff4ff', align: 'center' });
      S.drawText(ctx, line2, VW / 2, msgY + 50, { size: 11, color: '#bcd6f0', align: 'center' });
    },

    isDone: function () { return _done; },

    _debug: function () {
      return {
        phase: _phase, roundIdx: roundIdx, round: team.round, teamId: team.id, kicksPerSide: KICKS,
        attackShot: attackShot, attackGoals: attackGoals, defendShot: defendShot, defendSaves: defendSaves,
        playerGoals: _playerTotal(), oppGoals: _oppTotal(), roundsWon: roundsWon,
        champion: _phase === 'champion', done: _done,
      };
    },
  };
}

// ── UMD エクスポート ──
(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { createTournamentScene: createTournamentScene });
