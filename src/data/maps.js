// === maps.js ===
// フィールドマップの純粋データ＋タイル凡例。
// 純粋データのみ。トップレベルで document / window に触れない（Node require 対応）。

// ── タイル凡例 ───────────────────────────────────────────────────────
//   各文字 → 使用スプライト名（sprites.js のキー）と歩行可否。
var TILE_LEGEND = {
  '.': { sprite: 't_grass', walkable: true  }, // 草原
  ',': { sprite: 't_road',  walkable: true  }, // 土の道
  '#': { sprite: 't_wall',  walkable: false }, // 壁（通行不可）
  '~': { sprite: 't_water', walkable: false }, // 水（通行不可）
  'F': { sprite: 't_floor', walkable: true  }, // 室内の床
};

// ── マップ集 ─────────────────────────────────────────────────────────
//   grid は各行ぴったり16文字・18行。座標はタイル座標 (x=列, y=行)。
//   開始(5,5)・NPC(4,9)・宝箱(12,13) はいずれも歩けるタイルで、
//   開始から両方へ到達可能であることを確認済み。
var MAPS = {
  field1: {
    id: 'field1',
    name: 'はじまりの草原',
    grid: [
      '################', // r0
      '#..............#', // r1
      '#..,,,,,,,,,,..#', // r2
      '#..,........,..#', // r3
      '#..,..####..,..#', // r4
      '#..,..#FF#..,..#', // r5  ← 開始(5,5)='.'（小屋は r4-6 col6-9・装飾）
      '#..,..####..,..#', // r6
      '#..,........,..#', // r7
      '#..,,,,,,,,,,..#', // r8
      '#.....,..,.....#', // r9  ← NPC(4,9)='.'
      '#.....,..,.....#', // r10
      '#..~~.,..,..~~.#', // r11
      '#..~~....,.....#', // r12
      '#........,.....#', // r13 ← 宝箱(12,13)='.'
      '#..,,,,,,,,,,..#', // r14
      '#..,........,..#', // r15
      '#..,........,..#', // r16
      '################', // r17
    ],
    npcs: [
      {
        x: 4, y: 9, sprite: 'aoshi', pages: [
          'ようこそ ピッチランドへ！',
          'わるものに ぬすまれた「黄金のサッカーボール」を とりもどす たびだね。',
          'きたや みなみの みちを すすんで、スタジアムを めざそう！',
        ],
      },
    ],
    chests: [
      { id: 'field1_chest1', x: 12, y: 13, item: 'drink', amount: 1, label: 'スポーツドリンク' },
    ],
    encounter: { rate: 0.09, enemies: ['foul_goblin', 'offside_ghost'] },
  },
};

// ── 開発時アサート（グリッド整合の早期検出。Node でも例外を投げない安全側） ──
//   全行が16文字・18行であることを軽く確認する。ずれていたら警告のみ。
(function _assertGrids() {
  for (var id in MAPS) {
    if (!Object.prototype.hasOwnProperty.call(MAPS, id)) continue;
    var g = MAPS[id].grid;
    if (!g || !g.length) continue;
    var w = g[0].length;
    for (var r = 0; r < g.length; r++) {
      if (g[r].length !== w && typeof console !== 'undefined') {
        console.warn('[maps] grid row length mismatch in', id, 'row', r, '=', g[r].length, 'expected', w);
      }
    }
  }
})();

// ── UMD エクスポート ──────────────────────────────────────────────────
(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  MAPS: MAPS,
  TILE_LEGEND: TILE_LEGEND,
});
