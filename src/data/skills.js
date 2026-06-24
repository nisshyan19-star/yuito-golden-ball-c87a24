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
  golden_strike:  { id:'golden_strike',  name:'ゴールデン・ストライク',   user:'party',  mp:0,  type:'ultimate', power:3.0, target:'all',   learnLevel:null },
};

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { SKILLS });
