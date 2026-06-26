// === story.js ===
// ストーリー進行のロジック：仲間加入とエンディング。
// 純粋ロジックなので node でも require できるよう、依存は遅延解決する。

function _gameState() {
  if (typeof require !== 'undefined') return require('../core/game-state.js');
  return (typeof window !== 'undefined' && window.SRPG) || {};
}
function _progression() {
  if (typeof require !== 'undefined') return require('../logic/progression.js');
  return (typeof window !== 'undefined' && window.SRPG) || {};
}

// 仲間をパーティに加える。
// やさしい難易度なので、加入時にリーダー(ユイト)のレベル近くまで底上げして即戦力にする。
// すでに加入済みなら何もせず null を返す。成功したら加入したキャラ名を返す。
function joinAlly(state, id) {
  if (!state.party) state.party = [];
  if (!state.flags) state.flags = {};
  if (state.party.some(function (p) { return p.id === id; })) return null;

  var GS = _gameState();
  var PR = _progression();
  if (!GS.createCharacter) return null;

  var ch = GS.createCharacter(id);

  // リーダーのレベルに近づける（leader.level - 1、最低 1）
  var leader = state.party[0];
  var target = leader ? Math.max(1, leader.level - 1) : 1;
  if (PR.gainExp && PR.expForNextLevel) {
    var guard = 0;
    while (ch.level < target && guard < 99) {
      PR.gainExp(ch, PR.expForNextLevel(ch.level));
      guard++;
    }
  }
  ch.hp = ch.maxHp;
  ch.mp = ch.maxMp;
  ch.dead = false;

  state.party.push(ch);
  state.flags['joined_' + id] = true;
  return ch.name;
}

// エンディングのメッセージページ（仲間の名前を織り込んで作る）。
function getEnding(state) {
  var party = (state && state.party) || [];
  var names = party.map(function (p) { return p.name; });
  var mates = names.length > 1 ? names.slice(1).join('・') : 'なかま';

  return [
    'ダーク・カイザーは ひかりのなかへ きえていった……',
    'ユイトは とりもどした\n「おうごんの サッカーボール」を\n たかく かかげた！',
    'まちに へいわが もどり\nみんなの えがおが かえってきた。',
    mates + ' は ユイトに いった。\n「きみと たたかえて よかった！」',
    'ユイトは わらって うなずいた。\n「つぎは ほんものの しあいで しょうぶだ！」',
    'こうして ユイトの ぼうけんは\n しあわせな まくを とじた。',
    '― おわり ―\n\nあそんでくれて ありがとう！',
  ];
}

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  joinAlly: joinAlly,
  getEnding: getEnding,
});
