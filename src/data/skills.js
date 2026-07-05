const SKILLS = {
  drive_shoot:    { id:'drive_shoot',    name:'ドライブシュート',        user:'yuito',  mp:4,  type:'attack',   power:1.4, target:'one',    learnLevel:1 },
  overhead:       { id:'overhead',       name:'オーバーヘッドシュート',   user:'yuito',  mp:8,  type:'attack',   power:2.0, target:'one',    learnLevel:6 },
  header:         { id:'header',         name:'弾丸ヘディング',          user:'ikuma',  mp:3,  type:'attack',   power:1.4, target:'one',    learnLevel:1 },
  super_volley:   { id:'super_volley',   name:'スーパーボレー',          user:'ikuma',  mp:9,  type:'attack',   power:2.4, target:'one',    learnLevel:8 },
  razor_pass:     { id:'razor_pass',     name:'カミソリパス',            user:'aoshi',  mp:5,  type:'attack',   power:1.0, target:'all',    learnLevel:1 },
  field_control:  { id:'field_control',  name:'フィールドコントロール',   user:'aoshi',  mp:6,  type:'buff_def', amount:1.3, target:'allies', learnLevel:7 },
  tackle:         { id:'tackle',         name:'スライディングタックル',   user:'tomoki', mp:4,  type:'attack',   power:1.3, stun:0.3, target:'one', learnLevel:1 },
  guard:          { id:'guard',          name:'かべになる',              user:'tomoki', mp:0,  type:'cover',    target:'ally',   learnLevel:1 },
  super_save:     { id:'super_save',     name:'スーパーセーブ',          user:'itsuki', mp:4,  type:'heal',     heal:40,  target:'ally',   learnLevel:1 },
  healing_whistle:{ id:'healing_whistle',name:'ヒーリングホイッスル',     user:'itsuki', mp:10, type:'heal',     heal:35,  target:'allies', learnLevel:7 },

  // ── 中盤で覚える 新とくぎ（追加弾3・レベルで自動習得） ──────────────
  //   型は attack / heal / buff_def のみ（battle-scene の _useSkill が解決できる種類）。
  rolling_shoot:  { id:'rolling_shoot',  name:'ローリングシュート',       user:'yuito',  mp:12, type:'attack',   power:2.6, target:'one',    learnLevel:12 },
  hat_trick:      { id:'hat_trick',      name:'ハットトリック',           user:'ikuma',  mp:14, type:'attack',   power:1.7, target:'all',    learnLevel:13 },
  through_pass:   { id:'through_pass',   name:'スルーパスエース',         user:'aoshi',  mp:10, type:'attack',   power:2.3, target:'one',    learnLevel:11 },
  iron_wall:      { id:'iron_wall',      name:'アイアンウォール',         user:'tomoki', mp:8,  type:'buff_def', amount:1.4, target:'allies', learnLevel:12 },
  recovery_call:  { id:'recovery_call',  name:'リカバリーコール',         user:'itsuki', mp:14, type:'heal',     heal:55,  target:'allies', learnLevel:13 },

  golden_strike:  { id:'golden_strike',  name:'ゴールデン・ストライク',   user:'party',  mp:0,  type:'ultimate', power:3.0, target:'all',   learnLevel:null },

  // ── 必殺技（キアイゲージMAXで解放・mp不要・使うとキアイを全消費） ──
  // learnLevel:null＝レベルアップでは習得されない（最初から所持）。kiai＝必要キアイ量。
  ult_yuito:  { id:'ult_yuito',  name:'おうごんのドライブ',     user:'yuito',  mp:0, type:'attack', power:3.4, target:'one',    kiai:100, learnLevel:null },
  ult_ikuma:  { id:'ult_ikuma',  name:'フェニックスボレー',     user:'ikuma',  mp:0, type:'attack', power:3.6, target:'one',    kiai:100, learnLevel:null },
  ult_aoshi:  { id:'ult_aoshi',  name:'タクト・オブ・ゴッド',   user:'aoshi',  mp:0, type:'attack', power:2.0, target:'all',    kiai:100, learnLevel:null },
  ult_tomoki: { id:'ult_tomoki', name:'グランド・スマッシュ',   user:'tomoki', mp:0, type:'attack', power:3.0, target:'one',    kiai:100, learnLevel:null },
  ult_itsuki: { id:'ult_itsuki', name:'ミラクル・ヒール',       user:'itsuki', mp:0, type:'heal',   heal:200, target:'allies', kiai:100, learnLevel:null },

  // ── 隠し仲間（げんす／ミキティー／ナナカ）の通常わざ ──
  dark_drive:  { id:'dark_drive',  name:'ダーク・ドライブ',       user:'gensu',  mp:5, type:'attack', power:2.0, target:'one', learnLevel:1 },
  siren_shot:  { id:'siren_shot',  name:'セイレーン・ショット',   user:'mikity', mp:5, type:'attack', power:2.0, target:'one', learnLevel:1 },
  poka_punch:  { id:'poka_punch',  name:'ぽかぽかパンチ',         user:'nanaka', mp:2, type:'attack', power:0.6, target:'one', learnLevel:1 },

  // ── 隠し仲間の必殺技 ──
  ult_gensu:   { id:'ult_gensu',   name:'バイオレット・エンペラー', user:'gensu',  mp:0, type:'attack', power:3.8, target:'one', kiai:100, learnLevel:null },
  ult_mikity:  { id:'ult_mikity',  name:'セイレーン・ブレイズ',     user:'mikity', mp:0, type:'attack', power:3.6, target:'one', kiai:100, learnLevel:null },
  ult_nanaka:  { id:'ult_nanaka',  name:'イヤイヤ期',               user:'nanaka', mp:0, type:'attack', power:5.0, target:'all', kiai:100, learnLevel:null },
};

// ── 連携技（追加弾4-B・コンビ必殺技） ───────────────────────────────────
//   members の2人が「両方とも生きていて 両方ともキアイMAX」のときだけ発動できる、
//   ふつうの必殺技より さらに強いコンビ技。発動するとメンバー全員のキアイを全消費する。
//   ユイトは全コンビに入る（操作はユイト1人なので、れんけいコマンドはユイトの番に選ぶ）。
//   type は 'attack' のみ（battle-scene の _useCombo が解決できる種類）。heal を持つコンビは
//   攻撃と同時に味方全員を回復する。power は必殺技(3.0〜3.6)より高めに設定。
var COMBOS = {
  combo_ikuma:  { id:'combo_ikuma',  name:'ツインゴールド・シュート', members:['yuito','ikuma'],  type:'attack', power:4.2, target:'one', desc:'ユイトと イクマの ダブルエース シュート' },
  combo_aoshi:  { id:'combo_aoshi',  name:'オーケストラ・ブレイク',   members:['yuito','aoshi'],  type:'attack', power:2.6, target:'all', desc:'アオシの タクトで チームが いっせいに おそいかかる' },
  combo_tomoki: { id:'combo_tomoki', name:'カウンター・ラッシュ',     members:['yuito','tomoki'], type:'attack', power:4.8, target:'one', desc:'トモキの かべから ユイトの ひっさつ カウンター' },
  combo_itsuki: { id:'combo_itsuki', name:'ミラクル・ゲームメイク',   members:['yuito','itsuki'], type:'attack', power:3.0, target:'one', heal:120, desc:'イツキの こえで かいふくしながら こうげき' },
};

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { SKILLS, COMBOS });
