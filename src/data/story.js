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

// キャラ正典（characters.js）を遅延解決して、スタッフロールの役職を引く。
function _characters() {
  if (typeof require !== 'undefined') {
    try { return require('./characters.js').CHARACTERS || {}; } catch (e) { return {}; }
  }
  return (typeof window !== 'undefined' && window.SRPG && window.SRPG.CHARACTERS) || {};
}

// エンディングのメッセージページ（弾4＋作り込み版）。
//   絵本のように：けっちゃく→ボール再点灯→せかいに いろが もどる→歓声→
//   仲間ひとりずつの別れ→ユイトの感謝→「つぎは ほんものの しあい」→スタッフロール。
//   スタッフロールは実際に いる仲間を 役職つきで ひとりずつ クレジットする（加入状況に矛盾しない）。
function getEnding(state) {
  var party = (state && state.party) || [];
  var names = party.map(function (p) { return p.name; });
  var mates = names.length > 1 ? names.slice(1).join('・') : 'なかま';

  // ── 共通：役職つきスタッフロールを target 配列に積む ──
  var CH = _characters();
  function _roleOf(p) {
    var c = CH[p.id];
    return (c && c.position) || 'なかま';
  }
  function _staffRoll(target) {
    target.push('＊　＊　＊');
    target.push('スタッフロール');
    if (party[0]) {
      target.push('ゆうしゃ\n\n' + party[0].name + '　…　' + _roleOf(party[0]));
    }
    party.slice(1).forEach(function (p) {
      target.push('なかま\n\n' + p.name + '　…　' + _roleOf(p));
    });
    target.push('なかま … ' + mates);
  }

  // 第2章（追加弾5-A/E）：ネオ・カイザーを倒していれば「よみがえりし やみ」END。
  //   倒していなければ（フラグ無し）従来どおり 第1章END を返す。
  if (state && state.flags && state.flags.boss_neo_kaiser) {
    var p2 = [
      'ネオ・カイザーは、やみの\nかなたへ きえていった……',
      'よみがえった やみが、\nこんどこそ ほろびたのだ。',
      'くろい うずが きえ、\nまちに ひかりが もどってきた。',
      'おうごんの ボールが\nふたたび こがねに かがやく。',
      'ユイト「もう だれも、\nやみに おびえなくて いい。」',
    ];
    // 仲間ごとの 別れの ひとこと（第2章版・加入している子だけ）。
    var fw2 = {
      ikuma:  'イクマ「やみが もどっても\nおれたちなら へいきだ！」',
      aoshi:  'アオシ「きみと たたかえて\nほんとうに よかった。」',
      tomoki: 'トモキ「ぼくの まもりは\nもう やみにも まけないよ。」',
      itsuki: 'イツキ「この きせきを\nずっと わすれない！」',
    };
    party.forEach(function (p) { if (fw2[p.id]) p2.push(fw2[p.id]); });
    p2.push('ユイト「ありがとう、みんな。\nきみたちが いたから\nここまで これたんだ。」');
    p2.push('ユイトは わらった。\n「さあ、つぎこそ ほんものの\nサッカーの しあいだ！」');
    _staffRoll(p2);
    p2.push('そして…\nさいごまで\nあそんでくれた きみ！');
    p2.push('だい2しょう\n「よみがえりし やみ」\nクリア！');
    p2.push('― かんぜん クリア！ ―\n\nほんとうに ありがとう！');
    return p2;
  }

  var pages = [
    'ダーク・カイザーは、ひかりの\nなかへ きえていった……',
    'まちに ひかりが もどり、\nきえていた いろが よみがえる。',
    'ユイトは とりもどした\nおうごんの ボールを\nたかく かかげた！',
    'ボールは こがねに かがやき、\nまちじゅうを てらした。',
    'スタジアムに かんせいが\nひびきわたる。\nまちに へいわが もどった！',
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
  pages.push('ユイト「つぎは ほんものの\nしあいで しょうぶだ！」');
  pages.push('こうして ユイトたちの\nぼうけんは しあわせに とじた。');
  _staffRoll(pages);
  pages.push('そして…\nあそんでくれた きみ！');
  pages.push('「ユイトと おうごんの\nサッカーボール」');
  pages.push('― おわり ―\n\nあそんでくれて ありがとう！');
  return pages;
}

// === 進行ナビ（ストーリー進行ゲートの作り直し） ===
// objectiveFor: 撃破フラグの並びを1か所に集約し、「未達の最初の目標」を返す純粋関数。
//   返り値 { bar:HUD用の短文, npc:コーチ会話用のフル案内文, done:全クリアか }。
//   本線の順序は magma → guardian → kaiser → dark_general → ice → forest → neo_kaiser。
//   この順序が、出口の requireFlag（maps.js）と完全に一致している必要がある。
function objectiveFor(flags) {
  flags = flags || {};
  var spine = [
    { flag: 'joined_ikuma',
      bar: 'イクマを なかまに しよう！',
      npc: 'はじまりの草原に いる\nはやての FW イクマに\nはなしかけて なかまに しよう！' },
    { flag: 'boss_magma',
      bar: 'ほのおの どうくつへ！',
      npc: 'みのりの村の おくに ある\nほのおの どうくつで\nマグマ・ゴーレムを たおそう！' },
    { flag: 'joined_aoshi',
      bar: 'アオシを なかまに しよう！',
      npc: 'ナイタースタジアムに いる\nてんさい MF アオシに\nはなしかけて なかまに しよう！' },
    { flag: 'joined_tomoki',
      bar: 'トモキを なかまに しよう！',
      npc: 'サンドコートに いる\nまもりの DF トモキに\nはなしかけて なかまに しよう！' },
    { flag: 'joined_itsuki',
      bar: 'イツキを なかまに しよう！',
      npc: 'レイニーピッチに いる\nでんせつの GK イツキに\nはなしかけて なかまに しよう！' },
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
    { flag: 'boss_forest',
      bar: 'もりの しんでんへ！',
      npc: 'こおりの とうげの きたから\nもりの しんでんへ。\nさいじょうかいの 森の守り神\nガイアを たおそう！' },
    { flag: 'boss_neo_kaiser',
      bar: 'やみのしろへ！',
      npc: 'やみのしろの ネオ・カイザーを\nたおして せかいを すくおう！' },
    { flag: 'wc_qualify',
      bar: 'せかいたいかい 予選！',
      npc: 'だい3しょう スタート！\nグランドスタジアムで\nせかいたいかいの 予選を\nかちぬこう！' },
    { flag: 'wc_quarter',
      bar: 'じゅんじゅん決勝へ！',
      npc: '予選とっぱ！\nつぎは じゅんじゅん決勝だ。\nつぎの あいてに かとう！' },
    { flag: 'wc_semi',
      bar: 'じゅん決勝へ！',
      npc: 'じゅんじゅん決勝 とっぱ！\nじゅん決勝の あいてを\nやぶって 決勝へ すすもう！' },
    { flag: 'boss_volg',
      bar: '決勝せん ヴォルグ！',
      npc: 'いよいよ 決勝せん！\nさいきょうの ストライカー\nヴォルグを たおして\nせかい一に なろう！' },
    { flag: 'nebula_f1',
      bar: 'うちゅうせんかん ネビュラ号 F1！',
      npc: 'そらが われ うちゅう軍団が\nしゅうらい！\nうちゅうせんかん ネビュラ号の\nだい1フロアを とっぱしよう！' },
    { flag: 'nebula_f2',
      bar: 'ネビュラ号 F2へ！',
      npc: 'だい1フロア とっぱ！\nだい2フロアの てきを\nかわして すすもう！' },
    { flag: 'nebula_f3',
      bar: 'ネビュラ号 F3へ！',
      npc: 'だい2フロア とっぱ！\nだい3フロアの おくへ\nすすもう！' },
    { flag: 'boss_zeros',
      bar: 'ブリッジ ゼロス！',
      npc: 'さいしんぶの ブリッジで\nメカ・エンペラー ゼロスを\nたおそう！\n(かちで でんせつの ブーツ)' },
    { flag: 'trial_1',
      bar: 'せいしんの しんでん 試練1！',
      npc: 'ほしの かなたの\nせいしんの しんでんへ。\n試練その1を のりこえよう！' },
    { flag: 'trial_2',
      bar: '試練2へ！',
      npc: '試練その1 クリア！\n試練その2に ちょうせん！\n(とちゅうで でんせつの よろい)' },
    { flag: 'trial_3',
      bar: '試練3へ！',
      npc: '試練その2 クリア！\nさいごの 試練その3を\nのりこえよう！' },
    { flag: 'boss_asterion',
      bar: 'さいしゅうけっせん アステリオン！',
      npc: 'さいおくで ほしくいの神\nアステリオンが まっている。\nおうごんの ボールの しんじつと\nむきあい さいごの たたかいへ！' },
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
