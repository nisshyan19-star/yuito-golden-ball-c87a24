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

// === サブクエスト進行 ===
// 町の「おつかいクエスト」は3段フラグで進む：
//   acceptFlag … 依頼を受けた   itemFlag … 届け物を受け取った   doneFlag … 報酬を受領した
// 受注→別NPCから品物→依頼主へ戻して報酬、という一本道（町内で完結）。
//
// questStage: 今どの段階かを純粋関数で返す。
//   'done'(受領済み) | 'clear'(報酬を渡せる) | 'wait'(受注済み・品物まだ) | 'ask'(未受注)
function questStage(quest, flags) {
  flags = flags || {};
  if (!quest) return 'ask';
  if (quest.doneFlag && flags[quest.doneFlag]) return 'done';
  if (quest.itemFlag && flags[quest.itemFlag]) return 'clear';
  if (quest.acceptFlag && flags[quest.acceptFlag]) return 'wait';
  return 'ask';
}

// grantReward: 報酬(gold/item)を state に加算し、もらった物の説明文を返す。
//   reward = { gold?:number, item?:itemId, amount?:number, label?:'表示名' }
function grantReward(state, reward) {
  if (!state || !reward) return '';
  var parts = [];
  if (reward.gold) {
    state.gold = (state.gold || 0) + reward.gold;
    parts.push(reward.gold + 'ゴールド');
  }
  if (reward.item) {
    if (!state.inventory) state.inventory = {};
    var amt = reward.amount || 1;
    state.inventory[reward.item] = (state.inventory[reward.item] || 0) + amt;
    parts.push((reward.label || reward.item) + (amt > 1 ? (' x' + amt) : ''));
  }
  return parts.join('と');
}

// エンディングのメッセージページ（弾4で強化＝スタッフロール＋仲間ごとの別れ）。
//   実際にパーティに いる仲間だけ farewell を差し込むので、加入状況に矛盾しない。
function getEnding(state) {
  var party = (state && state.party) || [];
  var names = party.map(function (p) { return p.name; });
  var mates = names.length > 1 ? names.slice(1).join('・') : 'なかま';

  // 第2章（追加弾5-A/E）：ネオ・カイザーを倒していれば「よみがえりし やみ」END。
  //   倒していなければ（フラグ無し）従来どおり 第1章END を返す。
  if (state && state.flags && state.flags.boss_neo_kaiser) {
    var p2 = [
      'ネオ・カイザーは\nやみの かなたへ きえていった……',
      'よみがえった やみが\nついに ほろびたのだ。',
      'ユイト「もう だれも\nおびえなくて いい。」',
      'そらの くろい うずが きえ、\nまちに ひかりが さしこんだ。',
    ];
    // 仲間ごとの 別れの ひとこと（第2章版・加入している子だけ）。
    var fw2 = {
      ikuma:  'イクマ「やみが もどっても\nおれたちなら へいきだ！」',
      aoshi:  'アオシ「きみと たたかえて\nほんとうに よかった。」',
      tomoki: 'トモキ「ぼくの まもりは\nもう やみにも まけないよ。」',
      itsuki: 'イツキ「この きせきを\nずっと わすれない！」',
    };
    party.forEach(function (p) { if (fw2[p.id]) p2.push(fw2[p.id]); });
    p2.push('ユイト「さあ、つぎこそ\nほんものの サッカーの しあいだ！」');
    p2.push('＊　＊　＊');
    p2.push('スタッフロール\n\nゆうしゃ … ユイト');
    p2.push('なかま … ' + mates);
    p2.push('だい2しょう\n「よみがえりし やみ」\nクリア！');
    p2.push('― かんぜん クリア！ ―\n\nほんとうに ありがとう！');
    return p2;
  }

  var pages = [
    'ダーク・カイザーは\nひかりの なかへ きえていった……',
    'ユイトは とりもどした\n「おうごんの サッカーボール」を\nたかく かかげた！',
    'スタジアムに かんせいが ひびく。\nまちに へいわが もどったのだ。',
  ];

  // 仲間ごとの 別れの ひとこと（加入している子だけ）。
  var farewell = {
    ikuma:  'イクマ「ユイトと たたかえて\nさいこうに たのしかったぜ！」',
    aoshi:  'アオシ「つぎは スタジアムで\nほんとうの しあいを しよう。」',
    tomoki: 'トモキ「ぼくの まもりは\nきみたちが いたから だよ。」',
    itsuki: 'イツキ「この ゴールは\nぜったいに わすれない！」',
  };
  party.forEach(function (p) { if (farewell[p.id]) pages.push(farewell[p.id]); });

  pages.push('ユイトは わらって うなずいた。\n「みんな、ありがとう！」');
  pages.push('「つぎは ほんものの しあいで\nしょうぶだ！」');
  pages.push('こうして ユイトたちの ぼうけんは\nしあわせな まくを とじた。');
  pages.push('＊　＊　＊');
  pages.push('スタッフロール\n\nゆうしゃ … ユイト');
  pages.push('なかま … ' + mates);
  pages.push('そして…\nあそんでくれた きみ！');
  pages.push('「ユイトと おうごんの\nサッカーボール」');
  pages.push('― おわり ―\n\nあそんでくれて ありがとう！');
  return pages;
}

// === 進行ナビ（ストーリー進行ゲートの作り直し） ===
// objectiveFor: 撃破フラグの並びを1か所に集約し、「未達の最初の目標」を返す純粋関数。
//   返り値 { bar:HUD用の短文, npc:コーチ会話用のフル案内文, done:全クリアか }。
//   本線の順序は magma → guardian → kaiser → dark_general → ice → neo_kaiser。
//   この順序が、出口の requireFlag（maps.js）と完全に一致している必要がある。
function objectiveFor(flags) {
  flags = flags || {};
  var spine = [
    { flag: 'boss_magma',
      bar: 'ほのおの どうくつへ！',
      npc: 'みのりの村の おくに ある\nほのおの どうくつで\nマグマ・ゴーレムを たおそう！' },
    { flag: 'boss_guardian',
      bar: 'スカイスタジアムへ！',
      npc: 'つぎは スカイスタジアムで\nガーディアンを たおそう！' },
    { flag: 'boss_kaiser',
      bar: 'ダークアリーナへ！',
      npc: 'ダークアリーナの ボス\nダーク・カイザーを たおして\nだい1しょうを クリアしよう！' },
    { flag: 'boss_dark_general',
      bar: 'こおりの とうげへ！',
      npc: 'だい2しょう スタート！\nノルドタウンの きたの\nこおりの とうげで\nやみの しょうぐん ヴォルクを たおそう！' },
    { flag: 'boss_ice',
      bar: 'こおりの とうへ！',
      npc: 'ノルドタウンの ひがしの\nこおりの とうの てっぺんで\nアイス・ゴーレムを たおそう！' },
    { flag: 'boss_neo_kaiser',
      bar: 'やみのしろへ！',
      npc: 'やみのしろの ネオ・カイザーを\nたおして せかいを すくおう！' },
  ];
  for (var i = 0; i < spine.length; i++) {
    if (!flags[spine[i].flag]) {
      return { bar: spine[i].bar, npc: spine[i].npc, done: false };
    }
  }
  return {
    bar: 'すべて クリア！',
    npc: 'おめでとう！\nきみは ほんものの ゆうしゃだ！',
    done: true,
  };
}

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  joinAlly: joinAlly,
  getEnding: getEnding,
  questStage: questStage,
  grantReward: grantReward,
  objectiveFor: objectiveFor,
});
