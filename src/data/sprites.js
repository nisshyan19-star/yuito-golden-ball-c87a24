// === sprites.js ===
// ドット絵データ（文字列配列＋パレット方式）
// map: 各行は同じ長さの文字列。'.' と ' ' は透明。
// キャラ=32×32 / タイル=16×16。輪郭線＋陰影3〜4階調のモダンピクセルアート。
// 純粋データのみ。トップレベルで document / window に触れない（Node require 対応）。

var SPRITES = (function () {

  // ────────────────────────────────────────────────────────────
  // キャラ共通テンプレート（32×32・左右シンメトリー・約2.5頭身）
  //   O=輪郭線  H=髪明  h=髪中  g=髪影
  //   S=肌明  s=肌中  k=肌影  E=目  m=口
  //   U=ユニ明  u=ユニ中  v=ユニ影  N=背番号
  //   P=ズボン明  p=ズボン影
  //   L=脚明  l=脚影  K=靴明  c=靴影
  //   W=ボール白  b=ボール黒線  G=グローブ(GKのみ)
  // 各行きっちり32文字。透明は '.'。
  // ────────────────────────────────────────────────────────────
  function buildChar(pal, num, gk) {
    var n = num;            // 背番号テキスト用フラグ（描画はマップで表現）
    var glove = gk ? 'G' : 's'; // 手: GKは白グローブ、それ以外は肌
    var gl = gk ? 'G' : 'k';
    // 32×32 マップ。左右対称ベースで丁寧に陰影を入れる。
    var map = [
      '............OOOOOO..............',
      '..........OOhhhhhhOO............',
      '.........OHHhhhhhhHHO...........',
      '........OHHHhhhhhhHHHO..........',
      '........OHHhhhgggghhHO..........',
      '........OHhggOOOOgghHO..........',
      '........OOSSSSSSSSSSOO..........',
      '.......OSSSSSSSSSSSSSSO.........',
      '.......OSSSSSSSSSSSSSSO.........',
      '.......OSSEESSSSSSEESSO.........',
      '.......OSSEESSSSSSEESSO.........',
      '.......OSSSSSSSSSSSSSSO.........',
      '.......OSSSkSSmmSSkSSSO.........',
      '.......OSSSSSmmmmSSSSSO.........',
      '........OkSSSSSSSSSSkO..........',
      '........OOSSSSSSSSSSOO..........',
      '......OOOuuuuuuuuuuuuOOO........',
      '....OO'+glove+glove+'uUUUUUUUUUUuu'+glove+glove+'OO.......',
      '...O'+gl+glove+glove+'uUUUuNNUUUUuvv'+glove+glove+gl+'O.......',
      '...O'+gl+glove+glove+'uUUuNNNNUUUuvv'+glove+glove+gl+'O.......',
      '...OO'+gl+glove+'uUUUNNUUUUUuvv'+glove+gl+'OO.......',
      '.....OOuuUUUUUUUUUUuuOO.........',
      '.......OvUUUUUUUUUUvO...........',
      '.......OOPPPPpPPPPPOO...........',
      '.......OPPPPpppPPPPPO...........',
      '.......OLLLOOOOLLLLLO...........',
      '.......OLLLO..OLLLLLO...........',
      '.......OllLO..OLllllO...........',
      '......OKKKKO..OKKKKKO...WWWW....',
      '......OKKcKO..OKccKKO..WbbWWW...',
      '......OOcccO..OcccOOO..WWbbbW...',
      '.......OOOO....OOOO.....WWWW....',
    ];
    return { palette: pal, map: map };
  }

  // ── ユイト（主人公・FW・背番号10・ヴィッセル神戸クリムゾン・黒髪）──
  var yuito = buildChar({
    'O': '#2a0a14',
    'H': '#5a3d28', 'h': '#3d2a1c', 'g': '#2a1a12',
    'S': '#ffe0bd', 's': '#f0c79a', 'k': '#d99d6e',
    'E': '#3a241a', 'm': '#b85c4a',
    'U': '#c43a58', 'u': '#a01d3c', 'v': '#6e0f28', 'N': '#ffffff',
    'P': '#2a2f4a', 'p': '#1a1e34',
    'L': '#f0c79a', 'l': '#d99d6e',
    'K': '#ffffff', 'c': '#b8b8c0',
    'W': '#ffffff', 'b': '#1a1a1a',
  }, '10', false);

  // ── イクマ（FW・背番号9・青ユニ・金髪）──
  var ikuma = buildChar({
    'O': '#0a142e',
    'H': '#ffe884', 'h': '#f5d35a', 'g': '#e0b430',
    'S': '#ffe0bd', 's': '#f0c79a', 'k': '#d99d6e',
    'E': '#3a241a', 'm': '#b85c4a',
    'U': '#3d7be8', 'u': '#1b59c9', 'v': '#103a8f', 'N': '#ffffff',
    'P': '#2a2f4a', 'p': '#1a1e34',
    'L': '#f0c79a', 'l': '#d99d6e',
    'K': '#ffffff', 'c': '#b8b8c0',
    'W': '#ffffff', 'b': '#1a1a1a',
  }, '9', false);

  // ── アオシ（MF・背番号7・緑ユニ・茶髪）──
  var aoshi = buildChar({
    'O': '#0a200f',
    'H': '#a06a35', 'h': '#8a5a2c', 'g': '#6b4220',
    'S': '#ffe0bd', 's': '#f0c79a', 'k': '#d99d6e',
    'E': '#3a241a', 'm': '#b85c4a',
    'U': '#3cc46c', 'u': '#1f9d4d', 'v': '#127a38', 'N': '#ffffff',
    'P': '#2a2f4a', 'p': '#1a1e34',
    'L': '#f0c79a', 'l': '#d99d6e',
    'K': '#ffffff', 'c': '#b8b8c0',
    'W': '#ffffff', 'b': '#1a1a1a',
  }, '7', false);

  // ── トモキ（DF・背番号4・黄ユニ・黒髪・がっしり）──
  var tomoki = buildChar({
    'O': '#1a1a0a',
    'H': '#4a4a4a', 'h': '#333333', 'g': '#1a1a1a',
    'S': '#f7d2a8', 's': '#e6b487', 'k': '#cc8f5e',
    'E': '#2a1a12', 'm': '#a85040',
    'U': '#f5d84a', 'u': '#e8c21e', 'v': '#bf9e10', 'N': '#5a3a00',
    'P': '#2a2f4a', 'p': '#1a1e34',
    'L': '#e6b487', 'l': '#cc8f5e',
    'K': '#ffffff', 'c': '#b8b8c0',
    'W': '#ffffff', 'b': '#1a1a1a',
  }, '4', false);

  // ── イツキ（GK・背番号1・ティール/青緑ユニ・赤髪・GKグローブ）──
  var itsuki = buildChar({
    'O': '#0a2422',
    'H': '#ff7a64', 'h': '#f05a44', 'g': '#d23a26',
    'S': '#ffe0bd', 's': '#f0c79a', 'k': '#d99d6e',
    'E': '#3a241a', 'm': '#b85c4a',
    'U': '#2fc7bd', 'u': '#16a39a', 'v': '#0e7a73', 'N': '#ffffff',
    'P': '#2a2f4a', 'p': '#1a1e34',
    'L': '#f0c79a', 'l': '#d99d6e',
    'K': '#ffffff', 'c': '#b8b8c0',
    'W': '#ffffff', 'b': '#1a1a1a',
    'G': '#f2f2f7',
  }, '1', true);

  // ── コーチ／案内人（グレーのジャージ・背番号なし）──
  var coach = buildChar({
    'O': '#15171c',
    'H': '#8a8f99', 'h': '#6e7480', 'g': '#54596a',
    'S': '#f0d2b0', 's': '#e0b78e', 'k': '#c89568',
    'E': '#3a241a', 'm': '#a85040',
    'U': '#8a909a', 'u': '#6a707a', 'v': '#4a505a', 'N': '#8a909a',
    'P': '#2a2f4a', 'p': '#1a1e34',
    'L': '#e0b78e', 'l': '#c89568',
    'K': '#ffffff', 'c': '#b8b8c0',
    'W': '#ffffff', 'b': '#1a1a1a',
  }, '', false);

  // ── みせの ひと／店主（茶色のエプロン風・背番号なし）──
  var shopkeep = buildChar({
    'O': '#1c1208',
    'H': '#7a5a30', 'h': '#5e4424', 'g': '#46321a',
    'S': '#f7d2a8', 's': '#e6b487', 'k': '#cc8f5e',
    'E': '#3a241a', 'm': '#a85040',
    'U': '#b5824a', 'u': '#9a6a37', 'v': '#7a5228', 'N': '#b5824a',
    'P': '#3a2f24', 'p': '#241c14',
    'L': '#e6b487', 'l': '#cc8f5e',
    'K': '#8a6a4a', 'c': '#6a4e34',
    'W': '#ffffff', 'b': '#1a1a1a',
  }, '', false);

  // ── 鉄壁キーパー（中ボス・鋼色＋青いグローブ・険しい）──
  var keeper = buildChar({
    'O': '#0a0e16',
    'H': '#b8c0cc', 'h': '#98a0ac', 'g': '#78808c',
    'S': '#e6e0da', 's': '#c8c2bc', 'k': '#a8a29c',
    'E': '#1a3a5a', 'm': '#6a7280',
    'U': '#6a7280', 'u': '#4a5260', 'v': '#2e3540', 'N': '#6a7280',
    'P': '#2a2f3a', 'p': '#1a1e26',
    'L': '#c8c2bc', 'l': '#a8a29c',
    'K': '#3a3f4a', 'c': '#24282e',
    'W': '#ffffff', 'b': '#1a1a1a',
    'G': '#5ec8ff',
  }, '', true);

  // ── ダーク・カイザー（ラスボス・紫黒・赤い目）──
  var kaiser = buildChar({
    'O': '#050208',
    'H': '#6a4bce', 'h': '#4a2f9e', 'g': '#2e1a6e',
    'S': '#d8c0e0', 's': '#b89cc8', 'k': '#9678ac',
    'E': '#ff5a7a', 'm': '#7a3050',
    'U': '#3a2a5e', 'u': '#271a44', 'v': '#160e2a', 'N': '#3a2a5e',
    'P': '#160e2a', 'p': '#0a0614',
    'L': '#b89cc8', 'l': '#9678ac',
    'K': '#2a2a3a', 'c': '#16161e',
    'W': '#ffd76e', 'b': '#1a1a1a',
  }, '', false);

  // ── 町の人々（共通ボディの色替え・背番号なし）──
  var girl_pink = buildChar({
    'O':'#1c1015','H':'#8a5a3a','h':'#6e4428','g':'#523018','S':'#ffe0c4','s':'#f0c2a0','k':'#dc9e78','E':'#3a241a','m':'#c05070','U':'#ff9ec0','u':'#e87aa4','v':'#c85888','N':'#ff9ec0','P':'#d86a98','p':'#b04a78','L':'#f0c2a0','l':'#dc9e78','K':'#ffffff','c':'#e0a0c0','W':'#ffffff','b':'#1a1a1a',
  }, '', false);
  var boy_blue = buildChar({
    'O':'#0a0e18','H':'#3a2a1a','h':'#2a1e12','g':'#1a120a','S':'#ffe0c4','s':'#f0c2a0','k':'#dc9e78','E':'#2a3a5a','m':'#a85040','U':'#4a8ade','u':'#356ab8','v':'#254e8e','N':'#4a8ade','P':'#2a3f6a','p':'#1a2846','L':'#f0c2a0','l':'#dc9e78','K':'#ffffff','c':'#b8b8c0','W':'#ffffff','b':'#1a1a1a',
  }, '', false);
  var granny = buildChar({
    'O':'#1a1818','H':'#e8e8ee','h':'#c8c8d2','g':'#a8a8b4','S':'#f0d2b8','s':'#e0b89c','k':'#c89878','E':'#4a3a3a','m':'#a86070','U':'#b8a0c8','u':'#9a80ac','v':'#7a6090','N':'#b8a0c8','P':'#6a5878','p':'#4a3c56','L':'#e0b89c','l':'#c89878','K':'#8a7a6a','c':'#6a5c4e','W':'#ffffff','b':'#1a1a1a',
  }, '', false);
  var grandpa = buildChar({
    'O':'#181818','H':'#c0c0c6','h':'#9e9ea6','g':'#7c7c86','S':'#eccbb0','s':'#d8b090','k':'#c0946a','E':'#3a3030','m':'#9a6050','U':'#7a7050','u':'#5e5640','v':'#443e2c','N':'#7a7050','P':'#4a4436','p':'#322e24','L':'#d8b090','l':'#c0946a','K':'#5a4a3a','c':'#3e3228','W':'#ffffff','b':'#1a1a1a',
  }, '', false);
  var woman_brown = buildChar({
    'O':'#1a120a','H':'#7a4a24','h':'#5e381a','g':'#442810','S':'#ffdcc0','s':'#f0be9a','k':'#dc9a72','E':'#3a241a','m':'#b85868','U':'#4aa870','u':'#358858','v':'#256840','N':'#4aa870','P':'#3a6a4a','p':'#264a32','L':'#f0be9a','l':'#dc9a72','K':'#ffffff','c':'#b8c0b8','W':'#ffffff','b':'#1a1a1a',
  }, '', false);
  var young_man = buildChar({
    'O':'#0a0a0e','H':'#2a2426','h':'#1e1a1c','g':'#121012','S':'#f7d2a8','s':'#e6b487','k':'#cc8f5e','E':'#2a2420','m':'#a85040','U':'#f08a3a','u':'#d46a20','v':'#a84e14','N':'#f08a3a','P':'#3a3140','p':'#241e2a','L':'#e6b487','l':'#cc8f5e','K':'#ffffff','c':'#b8b8c0','W':'#ffffff','b':'#1a1a1a',
  }, '', false);
  var referee = buildChar({
    'O':'#0a0a0a','H':'#1a1a1a','h':'#101010','g':'#080808','S':'#f0d2b0','s':'#e0b78e','k':'#c89568','E':'#2a241a','m':'#a85040','U':'#2a2a2a','u':'#1a1a1a','v':'#0e0e0e','N':'#2a2a2a','P':'#1a1a1a','p':'#0a0a0a','L':'#e0b78e','l':'#c89568','K':'#e8e8e8','c':'#b0b0b0','W':'#ffff00','b':'#1a1a1a',
  }, '', false);
  var reporter = buildChar({
    'O':'#0a0c14','H':'#2a241e','h':'#1e1a14','g':'#12100c','S':'#f7d2a8','s':'#e6b487','k':'#cc8f5e','E':'#2a241a','m':'#a85040','U':'#2e3850','u':'#1e2638','v':'#121826','N':'#2e3850','P':'#1e2638','p':'#12161f','L':'#e6b487','l':'#cc8f5e','K':'#1a1a1a','c':'#3a3a3a','W':'#ffffff','b':'#1a1a1a',
  }, '', false);
  var vendor = buildChar({
    'O':'#180e08','H':'#5a3a1a','h':'#442a12','g':'#301c0a','S':'#f7d2a8','s':'#e6b487','k':'#cc8f5e','E':'#3a241a','m':'#a85040','U':'#c8503a','u':'#a83a26','v':'#842a18','N':'#c8503a','P':'#4a3a28','p':'#2e2418','L':'#e6b487','l':'#cc8f5e','K':'#8a6a4a','c':'#6a4e34','W':'#ffffff','b':'#1a1a1a',
  }, '', false);
  var supporter = buildChar({
    'O':'#181408','H':'#3a2a1a','h':'#2a1e12','g':'#1a120a','S':'#f7d2a8','s':'#e6b487','k':'#cc8f5e','E':'#2a241a','m':'#a85040','U':'#ffd23a','u':'#e8b820','v':'#c89814','N':'#ffd23a','P':'#3a5a8a','p':'#26406a','L':'#e6b487','l':'#cc8f5e','K':'#ffffff','c':'#b8b8c0','W':'#ffffff','b':'#1a1a1a',
  }, '', false);

  // ────────────────────────────────────────────────────────────
  // タイル5種（各16×16）— なめらかな陰影・規則的で上品なテクスチャ
  //   タイル境界が極端に目立たないよう端を揃える。
  // ────────────────────────────────────────────────────────────

  // ── t_grass（草原）控えめな縦グラデ＋点在しすぎない草葉 ──
  var t_grass = {
    palette: {
      'a': '#5cba5f', // 最明（上）
      'b': '#52b257',
      'G': '#4caf50', // 基調
      'c': '#46a04a',
      'd': '#3f9444', // 影（下）
      'l': '#6fc873', // 草葉ハイライト
    },
    map: [
      'aaaaaaaaaaaaaaaa',
      'aaaaaaaaaaaaaaaa',
      'bbbbbbbbbbbbbbbb',
      'bbbblbbbbbbbbbbb',
      'GGGGGGGGGGGlGGGG',
      'GGGGGGGGGGGGGGGG',
      'GGlGGGGGGGGGGGGG',
      'GGGGGGGGGGGGGlGG',
      'cccccccccccccccc',
      'ccccccclcccccccc',
      'cccccccccccccccc',
      'ccccccccccclcccc',
      'dddddddddddddddd',
      'ddddlddddddddddd',
      'dddddddddddddddd',
      'dddddddddddddddd',
    ]
  };

  // ── t_road（土の道）暖かいベージュ茶＋小石数個 ──
  var t_road = {
    palette: {
      'a': '#c79461', // 最明（上）
      'b': '#bd8a55',
      'R': '#b5824a', // 基調
      'c': '#a8763f',
      'd': '#9a6a37', // 影（下）
      's': '#d8b48a', // 小石明
      'o': '#8a5a2e', // 小石影
    },
    map: [
      'aaaaaaaaaaaaaaaa',
      'aaaaaaaaaaaaaaaa',
      'bbbbbbbbbbbbbbbb',
      'bbbbbbbbsobbbbbb',
      'RRRRRRRRRRRRRRRR',
      'RRRRRRRRRRRRRRRR',
      'RRsoRRRRRRRRRRRR',
      'RRRRRRRRRRRRRRRR',
      'cccccccccccccccc',
      'ccccccccccccsocc',
      'cccccccccccccccc',
      'cccccccccccccccc',
      'dddddddddddddddd',
      'ddddsodddddddddd',
      'dddddddddddddddd',
      'dddddddddddddddd',
    ]
  };

  // ── t_wall（石壁/レンガ）上辺ハイライト・下辺影で立体 ──
  var t_wall = {
    palette: {
      'H': '#a8a8b0', // ハイライト
      'W': '#8a8a92', // 石面
      'd': '#6e6e76', // 影
      'j': '#56565e', // 目地
    },
    map: [
      'HHHHHHHjHHHHHHHj',
      'WWWWWWWjWWWWWWWj',
      'WWWWWWWjWWWWWWWj',
      'dddddddjdddddddj',
      'jjjjjjjjjjjjjjjj',
      'HHHjHHHHHHHjHHHH',
      'WWWjWWWWWWWjWWWW',
      'WWWjWWWWWWWjWWWW',
      'dddjdddddddjdddd',
      'jjjjjjjjjjjjjjjj',
      'HHHHHHHjHHHHHHHj',
      'WWWWWWWjWWWWWWWj',
      'WWWWWWWjWWWWWWWj',
      'dddddddjdddddddj',
      'jjjjjjjjjjjjjjjj',
      'HHHjHHHHHHHjHHHH',
    ]
  };

  // ── t_water（水）横方向の波バンド＋柔らかい白ハイライト ──
  var t_water = {
    palette: {
      'a': '#42a5f5', // 明バンド
      'W': '#1e88e5', // 基調
      'd': '#1769bb', // 影バンド
      'C': '#bbdefb', // 白ハイライト
    },
    map: [
      'WWWWWWWWWWWWWWWW',
      'aaaaaaaaaaaaaaaa',
      'WWWWWWWWWWWWWWWW',
      'WWCCCWWWWWWCCCWW',
      'WWWWWWWWWWWWWWWW',
      'dddddddddddddddd',
      'WWWWWWWWWWWWWWWW',
      'aaaaaaaaaaaaaaaa',
      'WWWWWWCCCWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'dddddddddddddddd',
      'WWWWWWWWWWWWWWWW',
      'aaaaaaaaaaaaaaaa',
      'WWCCCWWWWWWCCCWW',
      'WWWWWWWWWWWWWWWW',
      'dddddddddddddddd',
    ]
  };

  // ── t_floor（室内の床/木）落ち着いた木目・継ぎ目控えめ ──
  var t_floor = {
    palette: {
      'a': '#caa97e', // 板明
      'B': '#bb9a6f', // 板基調
      'c': '#ab8a60', // 板影
      'g': '#caa97e', // 木目筋（明）
      'j': '#8c6c4a', // 継ぎ目
    },
    map: [
      'aaaaaaaaaaaaaaaa',
      'BBBBBBBBBBBBBBBB',
      'BBBBgBBBBBBBBBBB',
      'BBBBBBBBBBBgBBBB',
      'cccccccccccccccc',
      'jjjjjjjjjjjjjjjj',
      'aaaaaaaaaaaaaaaa',
      'BBBBBBBBBgBBBBBB',
      'BBgBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBgBB',
      'cccccccccccccccc',
      'jjjjjjjjjjjjjjjj',
      'aaaaaaaaaaaaaaaa',
      'BBBBBBgBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'cccccccccccccccc',
    ]
  };

  return {
    yuito:    yuito,
    ikuma:    ikuma,
    aoshi:    aoshi,
    tomoki:   tomoki,
    itsuki:   itsuki,
    coach:    coach,
    shopkeep: shopkeep,
    keeper:   keeper,
    kaiser:   kaiser,
    girl_pink:   girl_pink,
    boy_blue:    boy_blue,
    granny:      granny,
    grandpa:     grandpa,
    woman_brown: woman_brown,
    young_man:   young_man,
    referee:     referee,
    reporter:    reporter,
    vendor:      vendor,
    supporter:   supporter,
    t_grass: t_grass,
    t_road:  t_road,
    t_wall:  t_wall,
    t_water: t_water,
    t_floor: t_floor,
  };

})();

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { SPRITES: SPRITES });
