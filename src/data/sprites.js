// === sprites.js ===
// ドット絵データ（文字列配列＋パレット方式）
// map: 各行は同じ長さの文字列。'.' と ' ' は透明。
// 16×16 ピクセル チビキャラ＋タイル定義

var SPRITES = (function () {

  // ── ユイト（主人公・ヴィッセル神戸・クリムゾンユニ）──
  // 全行 16文字
  var yuito = {
    palette: {
      'H': '#3d1a00',
      'h': '#5c2800',
      'S': '#f5c89a',
      's': '#e0a87a',
      'U': '#9b1b3a',
      'u': '#7a1230',
      'N': '#ffffff',
      'P': '#1a2f8a',
      'p': '#132270',
      'L': '#f5c89a',
      'l': '#c8966a',
      'B': '#ffffff',
      'b': '#555555',
      'E': '#111111',
      'K': '#f0f0f0',
      'k': '#cccccc',
      'Z': '#333322',
    },
    map: [
      '....HHHHHHHH....',
      '...HhHhHhHhHH...',
      '...HSSSSSSSH....',
      '...HSEssSEsH....',
      '...HSSNNSSSH....',
      '...HssSSSssH....',
      '..HHUUUUUUHH....',
      '.UUUuUNuUuUUU...',
      '.UUuuNNNuuUU....',
      '.UUUuUNuUuUUU...',
      'SUUU..UUU..UUUS.',
      '.PPPPpPPpPPPP...',
      '.PPppPPPPppPP...',
      '.LLl..LLl..LL...',
      '.KKK..KKK..KK...',
      '.ZZZ.BbBbB.ZZ...',
    ]
  };

  // ── イクマ（青ユニ・金髪）──
  var ikuma = {
    palette: {
      'H': '#c8a000',
      'h': '#e0c000',
      'S': '#f5c89a',
      's': '#e0a87a',
      'U': '#1a4dbf',
      'u': '#123a9e',
      'N': '#ffffff',
      'P': '#0e2f6e',
      'p': '#091f50',
      'L': '#f5c89a',
      'l': '#c8966a',
      'E': '#111111',
      'K': '#f0f0f0',
      'k': '#cccccc',
      'Z': '#222211',
    },
    map: [
      '....HHHHHHHH....',
      '...HhHhHhHhHH...',
      '...HSSSSSSSH....',
      '...HSEssSEsH....',
      '...HSSsSSSSH....',
      '...HsSSSSSsH....',
      '..HHUUUUUUHH....',
      '.UUUuUUuUuUUU...',
      '.UUuuNUNuuUU....',
      '.UUUuUUuUuUUU...',
      'SUUU..UUU..UUUS.',
      '.PPPPpPPpPPPP...',
      '.PPppPPPPppPP...',
      '.LLl..LLl..LL...',
      '.KKK..KKK..KK...',
      '.ZZZ..ZZZ..ZZ...',
    ]
  };

  // ── アオシ（緑ユニ・茶髪）──
  var aoshi = {
    palette: {
      'H': '#6b3a00',
      'h': '#8b5200',
      'S': '#f5c89a',
      's': '#e0a87a',
      'U': '#1a8c3a',
      'u': '#12642a',
      'N': '#ffffff',
      'P': '#0d5a24',
      'p': '#084018',
      'L': '#f5c89a',
      'l': '#c8966a',
      'E': '#111111',
      'K': '#f0f0f0',
      'k': '#cccccc',
      'Z': '#222211',
    },
    map: [
      '....HHHHHHHH....',
      '...HhHhHhHhHH...',
      '...HSSSSSSSH....',
      '...HSEssSEsH....',
      '...HSSsSSSSH....',
      '...HsSSSSSsH....',
      '..HHUUUUUUHH....',
      '.UUUuUUuUuUUU...',
      '.UUuuNUNuuUU....',
      '.UUUuUUuUuUUU...',
      'SUUU..UUU..UUUS.',
      '.PPPPpPPpPPPP...',
      '.PPppPPPPppPP...',
      '.LLl..LLl..LL...',
      '.KKK..KKK..KK...',
      '.ZZZ..ZZZ..ZZ...',
    ]
  };

  // ── トモキ（黄ユニ・黒髪・GK）──
  var tomoki = {
    palette: {
      'H': '#1a1a1a',
      'h': '#333333',
      'S': '#f0b87a',
      's': '#d09050',
      'U': '#e8c400',
      'u': '#c0a000',
      'N': '#ffffff',
      'P': '#1a1a1a',
      'p': '#0a0a0a',
      'L': '#f0b87a',
      'l': '#c08050',
      'E': '#111111',
      'K': '#ffffff',
      'k': '#dddddd',
      'Z': '#222211',
      'G': '#f5c89a',
    },
    map: [
      '....HHHHHHHH....',
      '...HhHhHhHhHH...',
      '...HSSSSSSSH....',
      '...HSEssSEsH....',
      '...HSSsSSSSH....',
      '...HsSSSSSsH....',
      '..HHUUUUUUHH....',
      '.UUUuUUuUuUUU...',
      '.UUuuUUUuuUU....',
      '.UUUuUUuUuUUU...',
      'GUUU..UUU..UUUG.',
      '.PPPPpPPpPPPP...',
      '.PPppPPPPppPP...',
      '.LLl..LLl..LL...',
      '.KKK..KKK..KK...',
      '.ZZZ..ZZZ..ZZ...',
    ]
  };

  // ── イツキ（白ユニ・赤髪）──
  var itsuki = {
    palette: {
      'H': '#cc2200',
      'h': '#ff4422',
      'S': '#f5c89a',
      's': '#e0a87a',
      'U': '#f0f0f0',
      'u': '#cccccc',
      'N': '#cc2200',
      'P': '#cc2200',
      'p': '#991a00',
      'L': '#f5c89a',
      'l': '#c8966a',
      'E': '#111111',
      'K': '#f0f0f0',
      'k': '#cccccc',
      'Z': '#222211',
    },
    map: [
      '....HHHHHHHH....',
      '...HhHhHhHhHH...',
      '...HSSSSSSSH....',
      '...HSEssSEsH....',
      '...HSSsSSSSH....',
      '...HsSSSSSsH....',
      '..HHUUUUUuHH....',
      '.UUUuNNNuuUUU...',
      '.UUuuUUUuuUU....',
      '.UUUuNNNuuUUU...',
      'SUUU..UUU..UUUS.',
      '.PPPPpPPpPPPP...',
      '.PPppPPPPppPP...',
      '.LLl..LLl..LL...',
      '.KKK..KKK..KK...',
      '.ZZZ..ZZZ..ZZ...',
    ]
  };

  // ── タイル: 草（明るい緑）16×16 ──
  var t_grass = {
    palette: {
      'G': '#4caf50',
      'g': '#66bb6a',
      'd': '#388e3c',
      'f': '#2e7d32',
      'F': '#81c784',
    },
    map: [
      'GGgGGGgGGGgGGGgG',
      'GGGGdGGGGdGGGGdG',
      'gGGGGGgGGGGGgGGG',
      'GdGGGGGdGGGGGdGG',
      'GGGfGGGGGfGGGGGf',
      'GGGGGGGGGGGGGGGg',
      'gGGGGgGGGGgGGGGG',
      'GGGGGGGdGGGGGGdG',
      'GGgGGGGGGgGGGGGG',
      'GGGGfGGGGGGfGGGG',
      'GdGGGGGGGGGGGdGG',
      'GGGGGgGGGGgGGGGG',
      'GGGGGGGGGfGGGGGf',
      'gGGGdGGGGGGGdGGG',
      'GGGGGGGGGGGGGGGG',
      'GGgGGgGGGGgGGgGG',
    ]
  };

  // ── タイル: 土の道（茶）16×16 ──
  var t_road = {
    palette: {
      'R': '#a0622a',
      'r': '#b8783a',
      'd': '#7a4a18',
      'f': '#5a3210',
      'F': '#c89060',
    },
    map: [
      'RRrRRRrRRRrRRRrR',
      'RRRRdRRRRdRRRRdR',
      'rRRRRRrRRRRRrRRR',
      'RdRRRRRdRRRRRdRR',
      'RRRfRRRRRfRRRRRf',
      'RRRRFRRRRFRRRRFr',
      'rRRRRrRRRRrRRRRR',
      'RRRRRRRdRRRRRRdR',
      'RRrRRRRRRrRRRRRR',
      'RRRRfRRRRRRfRRRR',
      'RdRRRRRRRRRRRdRR',
      'RRRRRrRRRRrRRRRR',
      'RRRRRRRRRfRRRRRf',
      'rRRRdRRRRRRRdRRR',
      'RRRRRRRRRRRRRRRR',
      'RRrRRrRRRRrRRrRR',
    ]
  };

  // ── タイル: 石壁（グレー）16×16 ──
  var t_wall = {
    palette: {
      'W': '#8a8a8a',
      'w': '#aaaaaa',
      'd': '#5a5a5a',
      'f': '#3a3a3a',
      'j': '#666666',
    },
    map: [
      'wwwwwwwwwwwwwwww',
      'wWWWWWWWwWWWWWWw',
      'wWWWWWWWwWWWWWWw',
      'wWWWWWWWwWWWWWWw',
      'wWWWWWWWwWWWWWWw',
      'wWWWWWWWwWWWWWWw',
      'jjjjjjjjjjjjjjjj',
      'wWWWWwWWWWWwWWWw',
      'wWWWWwWWWWWwWWWw',
      'wWWWWwWWWWWwWWWw',
      'wWWWWwWWWWWwWWWw',
      'wWWWWwWWWWWwWWWw',
      'wWWWWwWWWWWwWWWw',
      'jjjjjjjjjjjjjjjj',
      'wWWWWWWWwWWWWWWw',
      'dddddddddddddddd',
    ]
  };

  // ── タイル: 水（青）16×16 ──
  var t_water = {
    palette: {
      'W': '#1565c0',
      'w': '#1e88e5',
      'f': '#0d47a1',
      'F': '#42a5f5',
      'C': '#bbdefb',
    },
    map: [
      'WWWwWWWWWwWWWWwW',
      'WwWWWWwWWWWWWWWW',
      'WWWWWWWWwWWwWWWW',
      'CCCCWWWWWWWWCCCC',
      'WWWWWWWWWWWWWWwW',
      'WfWWfWWWfWWWfWWW',
      'WWWWWWwWWWWWWWWW',
      'WwWWWWWWWwWWWWwW',
      'WWWWCCCCWWWWCCCC',
      'WWWWWWWWWWWwWWWW',
      'WfWWWfWWWfWWWfWW',
      'WWWWWWWWWWWWWWwW',
      'WwWWWwWWWWWWWWWW',
      'CCCCWWWWCCCCWWWW',
      'WWWWWWWWWWWWWwWW',
      'WfWWfWWWfWWWfWWW',
    ]
  };

  // ── タイル: 床（ベージュ）16×16 ──
  var t_floor = {
    palette: {
      'B': '#d4b896',
      'b': '#e8ccaa',
      'd': '#b09070',
      'f': '#8c6c50',
      'j': '#c4a882',
    },
    map: [
      'bBBBBBBBbBBBBBBb',
      'BBBBBBBBBBBBBBBj',
      'BBBBBBBBBBBBBBBj',
      'BBBBBBBBBBBBBBBj',
      'BBBBBBBBBBBBBBBj',
      'BBBBBBBBBBBBBBBj',
      'BBBBBBBBBBBBBBBj',
      'jjjjjjjjjjjjjjjj',
      'bBBBBBBBbBBBBBBb',
      'BBBBBBBBBBBBBBBj',
      'BBBBBBBBBBBBBBBj',
      'BBBBBBBBBBBBBBBj',
      'BBBBBBBBBBBBBBBj',
      'BBBBBBBBBBBBBBBj',
      'BBBBBBBBBBBBBBBj',
      'jjjjjjjjjjjjjjjj',
    ]
  };

  return {
    yuito:   yuito,
    ikuma:   ikuma,
    aoshi:   aoshi,
    tomoki:  tomoki,
    itsuki:  itsuki,
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
