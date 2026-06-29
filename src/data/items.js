const ITEMS = {
  drink:           { id:'drink',           name:'スポーツドリンク',       kind:'item',   effect:{ hp:30 },        price:20,  desc:'HPを 30 かいふくする さわやかな ドリンク。' },
  jelly:           { id:'jelly',           name:'エナジーゼリー',         kind:'item',   effect:{ mp:20 },        price:30,  desc:'MPを 20 かいふくする あまい ゼリー。' },
  firstaid:        { id:'firstaid',        name:'救急バッグ',             kind:'item',   effect:{ hp:120 },       price:80,  desc:'HPを 120 おおきく かいふくする きゅうきゅうセット。' },
  restart_whistle: { id:'restart_whistle', name:'リスタートの笛',         kind:'item',   effect:{ revive:0.5 },   price:120, desc:'たおれた なかまを HP はんぶんで ふっかつさせる ふえ。' },
  spike1:          { id:'spike1',          name:'トレーニングシューズ',   kind:'weapon', atk:3,                   price:60,  desc:'こうげき+3。れんしゅうよう の きほんの シューズ。' },
  spike2:          { id:'spike2',          name:'スピードスパイク',       kind:'weapon', atk:7,                   price:200, desc:'こうげき+7。はやく うごける かるい スパイク。' },
  spike3:          { id:'spike3',          name:'ゴールデンスパイク',     kind:'weapon', atk:14,                  price:600, desc:'こうげき+14。きんいろに かがやく つよい スパイク。' },
  uni1:            { id:'uni1',            name:'れんしゅうユニフォーム', kind:'armor',  def:3,                   price:60,  desc:'まもり+3。れんしゅうよう の きほんの ユニフォーム。' },
  uni2:            { id:'uni2',            name:'チームユニフォーム',     kind:'armor',  def:7,                   price:200, desc:'まもり+7。チームの せいしきな ユニフォーム。' },
  uni3:            { id:'uni3',            name:'おうごんユニフォーム',   kind:'armor',  def:14,                  price:600, desc:'まもり+14。きんいろに かがやく じょうぶな ユニフォーム。' },
  phantom_cleats:  { id:'phantom_cleats',  name:'まぼろしのスパイク',     kind:'weapon', atk:20,                  price:900, desc:'こうげき+20。まぼろしと よばれる でんせつの スパイク。' },
  // ── でんせつの ほうび（追加弾3）：legend_arena 専用ボスの ごほうび。最強装備。 ──
  emperor_boots:   { id:'emperor_boots',   name:'こうていの ブーツ',       kind:'weapon', atk:28,                  price:1500, desc:'こうげき+28。おうの ちからを やどした ブーツ。' },
  emperor_armor:   { id:'emperor_armor',   name:'おうごんの よろい',       kind:'armor',  def:20,                  price:1500, desc:'まもり+20。おうの ちからを やどした きんの よろい。' },
  // ── チャンピオンの あかし（追加弾4-D）：ボスラッシュ「ちょうせんの間」全クリアの トロフィー。ゲーム最強の ぶき。 ──
  champion_spike:  { id:'champion_spike',  name:'チャンピオンシューズ',   kind:'weapon', atk:32,                  price:2000, desc:'こうげき+32。ちょうせんの間を せいはした しょうこの シューズ。' },
  // ── サッカー トーナメント ゆうしょうの あかし（追加弾5-C）：3チーム勝ち抜きの トロフィー武器。 ──
  champ_ball:      { id:'champ_ball',      name:'ゆうしょうボール',       kind:'weapon', atk:30,  price:1200, desc:'トーナメントを せいはした しょうこの かがやく ボール。' },

  // ── そざい（追加弾5-D）：てきが おとす かけら。かじやで そうびに あわせる。kind:'material'。 ──
  mat_iron:        { id:'mat_iron',        name:'てつのかけら',           kind:'material', price:8,   desc:'じゃくてきが おとす かたい てつ。' },
  mat_leather:     { id:'mat_leather',     name:'じょうぶなかわ',         kind:'material', price:8,   desc:'やぶれにくい じょうぶな かわ。' },
  mat_silver:      { id:'mat_silver',      name:'ぎんのかけら',           kind:'material', price:20,  desc:'ちゅうばんの てきが おとす ぎん。' },
  mat_crystal:     { id:'mat_crystal',     name:'ちからのクリスタル',     kind:'material', price:60,  desc:'ちからが やどる レアな けっしょう。' },
  mat_gold:        { id:'mat_gold',        name:'こがねのかけら',         kind:'material', price:120, desc:'ボスが おとす かがやく こがね。' },
  mat_star:        { id:'mat_star',        name:'でんせつのほし',         kind:'material', price:300, desc:'つよい ボスだけが もつ ほしの かけら。' },

  // ── かじやで つくる そうび（追加弾5-D）：ショップには ならばない。そざい＋ゴールドで ごうせい。 ──
  forged_blade:    { id:'forged_blade',    name:'こうてつスパイク',       kind:'weapon', atk:18,  price:200,  desc:'てつを きたえた じょうぶな スパイク。' },
  forged_guard:    { id:'forged_guard',    name:'こうてつガード',         kind:'armor',  def:12,  price:200,  desc:'てつと かわで まもりを かためた ぼうぐ。' },
  mithril_spike:   { id:'mithril_spike',   name:'ミスリルスパイク',       kind:'weapon', atk:26,  price:600,  desc:'ぎんと クリスタルの かがやく スパイク。' },
  mithril_armor:   { id:'mithril_armor',   name:'ミスリルアーマー',       kind:'armor',  def:18,  price:600,  desc:'ぎんで あんだ かるくて つよい よろい。' },
  star_boots:      { id:'star_boots',      name:'せいなるブーツ',         kind:'weapon', atk:40,  price:1500, desc:'ほしの ちからを やどした さいきょうの ブーツ。' },
  star_mail:       { id:'star_mail',       name:'せいなるよろい',         kind:'armor',  def:28,  price:1500, desc:'ほしの ちからを やどした さいきょうの よろい。' },
};

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { ITEMS });
