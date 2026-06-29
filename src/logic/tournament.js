// === tournament.js（追加弾5-C：サッカー トーナメント） ===
// PK戦を「攻守そろった 1試合」へ発展させ、3チーム勝ち抜きの トーナメントにする。
// すべて純粋関数＋データ。描画やシーン進行は tournament-scene.js / field-scene.js が担当する。
// 乱数は rng 引数（[0,1) を返す関数）を注入でき、未指定なら Math.random を使う＝テストで決定的にできる。

var DIRS_T = ['left', 'center', 'right']; // 既存 pkResolve と同じ方向集合（トップレベル名は衝突回避で _T 付き）

// 対戦チーム定義。skill が高いほど キーパーが かしこく とび、シューターも コースを ついてくる。
//   color は スコアボード／演出の チームカラー。じゃくい→つよい の順。
var TOURNAMENT_TEAMS = [
  { id: 'wind',  name: 'ウィンドFC',         color: '#5ec8ff', skill: 0.25 },
  { id: 'flame', name: 'フレイム ユナイテッド', color: '#ff7a3c', skill: 0.45 },
  { id: 'storm', name: 'ストーム キングス',   color: '#b07cff', skill: 0.65 },
];

// buildBracket: トーナメントの対戦順（弱い→強い）を返す。各要素に round ラベルを付ける。
//   返り値は新しい配列＝TOURNAMENT_TEAMS を破壊しない。
function buildBracket() {
  var labels = ['じゅんじゅんけっしょう', 'じゅんけっしょう', 'けっしょう'];
  return TOURNAMENT_TEAMS.map(function (t, i) {
    return {
      id: t.id, name: t.name, color: t.color, skill: t.skill,
      round: labels[i] || ('だい' + (i + 1) + 'せん'),
    };
  });
}

// keeperDiveFor: プレイヤーのシュート方向 playerShot に対し、相手キーパーが とぶ方向を返す。
//   rng() < skill なら「よみ あたり」＝playerShot と同じ方向にとぶ（＝セーブされる）。
//   はずれなら 3方向から一様ランダムに とぶ。rng は最大2回呼ぶ（1回目=かしこさ判定 / 2回目=方向）。
function keeperDiveFor(playerShot, skill, rng) {
  var r = (typeof rng === 'function') ? rng : Math.random;
  if (r() < (skill || 0)) return playerShot;        // よみ あたり＝セーブ
  return DIRS_T[Math.floor(r() * DIRS_T.length)];    // よみ はずれ＝ランダム方向
}

// opponentShotFor: 相手シューターが ねらう方向を返す。
//   rng() < skill なら「コースを つく」＝左右どちらかへ（center を さける＝止めにくい）。
//   そうでなければ 3方向から一様ランダム。
function opponentShotFor(skill, rng) {
  var r = (typeof rng === 'function') ? rng : Math.random;
  if (r() < (skill || 0)) return (r() < 0.5) ? 'left' : 'right'; // コースを つく
  return DIRS_T[Math.floor(r() * DIRS_T.length)];                 // ふつうの ランダム
}

// matchWinner: 1試合のスコアから勝敗を返す。'player' | 'opponent' | 'draw'。
function matchWinner(playerGoals, oppGoals) {
  if (playerGoals > oppGoals) return 'player';
  if (playerGoals < oppGoals) return 'opponent';
  return 'draw';
}

// ── UMD エクスポート（battle.js と同じ書式） ──
(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  TOURNAMENT_TEAMS: TOURNAMENT_TEAMS,
  buildBracket: buildBracket,
  keeperDiveFor: keeperDiveFor,
  opponentShotFor: opponentShotFor,
  matchWinner: matchWinner,
});
