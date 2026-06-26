// === maps.js ===
// フィールドマップの純粋データ＋タイル凡例。
// 純粋データのみ。トップレベルで document / window に触れない（Node require 対応）。
//
// ⚠️ バンドルスコープの鉄則：トップレベルは var の TILE_LEGEND / MAPS のみ（const 禁止＝重複宣言で SyntaxError）。
//
// マップは縦に field1→field6 と連結。各マップ下中央(7,16)が出口、到着は上中央(7,2)。
// NPC には用途別フィールドを持たせる：
//   joinId   … 話すと仲間に加わる（vanishFlag をセットして以後 _withActiveNpcs で消える）
//   shop     … 話すと買い物（shopDef = {type,name,items,greeting?}）
//   boss     … 話すと強制バトル（boss = {enemies,winFlag,vanishFlag,ending?}）
//   plain    … 会話のみ（pages のみ）
// 出口 exit = {x,y,to,tx,ty, requireFlag?, lockedMsg?}

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
var MAPS = {
  // ── field1：はじまりの草原（ユイト出発・イクマ加入・道具屋） ──────────
  //   ※ grid と (4,9)NPC・宝箱(12,13) は field.test.js が固定。改変禁止。
  field1: {
    id: 'field1',
    name: 'はじまりの草原',
    grid: [
      '################', // r0
      '#..............#', // r1
      '#..,,,,,,,,,,..#', // r2
      '#..,........,..#', // r3  ← 道具屋(12,3)=','
      '#..,..####..,..#', // r4
      '#..,..#FF#..,..#', // r5  ← 開始(5,5)='.'（小屋は r4-6 col6-9・装飾）
      '#..,..####..,..#', // r6
      '#..,........,..#', // r7
      '#..,,,,,,,,,,..#', // r8
      '#.....,..,.....#', // r9  ← コーチ(4,9)='.'／イクマ(9,9)=','
      '#.....,..,.....#', // r10
      '#..~~.,..,..~~.#', // r11
      '#..~~....,.....#', // r12
      '#........,.....#', // r13 ← 宝箱(12,13)='.'
      '#..,,,,,,,,,,..#', // r14
      '#..,........,..#', // r15
      '#..,........,..#', // r16 ← 出口(7,16)='.'
      '################', // r17
    ],
    npcs: [
      {
        x: 4, y: 9, sprite: 'coach', pages: [
          'ようこそ ピッチランドへ！',
          'わるい ダーク・カイザーに ぬすまれた\n「おうごんの サッカーボール」を とりもどす たびだ。',
          'みなみ（した）の みちを すすんで\nスタジアムを めざそう！',
          'なかまを あつめれば もっと つよくなれるぞ！',
        ],
      },
      {
        x: 9, y: 9, sprite: 'ikuma', joinId: 'ikuma', vanishFlag: 'joined_ikuma',
        pages: [
          'やあ ユイト！ おれは イクマ。',
          'GK（ゴールキーパー）だけど\nきょうは キミと たたかいたいんだ！',
          'いっしょに ボールを とりもどそう！',
        ],
        afterPages: ['イクマ「うしろは まかせろ！」'],
      },
      {
        x: 12, y: 3, sprite: 'shopkeep', shop: {
          type: 'item', name: 'どうぐ屋',
          greeting: 'いらっしゃい！ かいものかな？',
          items: ['drink', 'jelly', 'firstaid', 'restart_whistle'],
        },
      },
    ],
    chests: [
      { id: 'field1_chest1', x: 12, y: 13, item: 'drink', amount: 1, label: 'スポーツドリンク' },
    ],
    exits: [
      { x: 7, y: 16, to: 'field2', tx: 7, ty: 2 },
    ],
    encounter: { rate: 0.09, enemies: ['foul_goblin', 'offside_ghost'] },
  },

  // ── field2：ナイタースタジアム（アオシ加入・装備屋） ──────────────────
  field2: {
    id: 'field2',
    name: 'ナイタースタジアム',
    grid: [
      '################', // r0
      '#......,.......#', // r1
      '#......,.......#', // r2  ← 到着(7,2)
      '#......,.......#', // r3
      '#.##...,..##...#', // r4  ← 観客席（装飾）
      '#.##...,..##...#', // r5
      '#......,.......#', // r6
      '#......,.......#', // r7
      '#......,.......#', // r8  ← アオシ(4,8)／装備屋(11,8)
      '#......,.......#', // r9
      '#......,.......#', // r10
      '#......,.......#', // r11 ← 宝箱(12,11)
      '#......,.......#', // r12
      '#......,.......#', // r13
      '#......,.......#', // r14
      '#......,.......#', // r15
      '#......,.......#', // r16 ← 出口(7,16)
      '################', // r17
    ],
    npcs: [
      {
        x: 4, y: 8, sprite: 'aoshi', joinId: 'aoshi', vanishFlag: 'joined_aoshi',
        pages: [
          'おお ユイト！ おれは アオシ。',
          'スピードなら だれにも まけない\nMF（ミッドフィルダー）だ！',
          'なかまに いれてくれよ！',
        ],
        afterPages: ['アオシ「スピードで かきまわすぜ！」'],
      },
      {
        x: 11, y: 8, sprite: 'shopkeep', shop: {
          type: 'equip', name: 'そうび屋',
          greeting: 'いい スパイクが あるよ！',
          items: ['spike1', 'spike2', 'uni1', 'uni2'],
        },
      },
    ],
    chests: [
      { id: 'field2_chest1', x: 12, y: 11, item: 'jelly', amount: 1, label: 'スタミナゼリー' },
    ],
    exits: [
      { x: 7, y: 16, to: 'field3', tx: 7, ty: 2 },
    ],
    encounter: { rate: 0.10, enemies: ['foul_goblin', 'offside_ghost'] },
  },

  // ── field3：サンドコート（トモキ加入） ──────────────────────────────
  field3: {
    id: 'field3',
    name: 'サンドコート',
    grid: [
      '################', // r0
      '#......,.......#', // r1
      '#......,.......#', // r2  ← 到着(7,2)
      '#......,.......#', // r3
      '#......,.......#', // r4
      '#..~~..,...~~..#', // r5  ← 水たまり（装飾）
      '#..~~..,...~~..#', // r6
      '#......,.......#', // r7
      '#......,.......#', // r8  ← トモキ(5,8)
      '#......,.......#', // r9
      '#......,.......#', // r10
      '#......,.......#', // r11
      '#......,.......#', // r12
      '#......,.......#', // r13 ← 宝箱(3,13)
      '#......,.......#', // r14
      '#......,.......#', // r15
      '#......,.......#', // r16 ← 出口(7,16)
      '################', // r17
    ],
    npcs: [
      {
        x: 5, y: 8, sprite: 'tomoki', joinId: 'tomoki', vanishFlag: 'joined_tomoki',
        pages: [
          'ぼくは トモキ。DF（ディフェンダー）だよ。',
          'まもりには じしんが あるんだ。',
          'みんなを まもらせて！',
        ],
        afterPages: ['トモキ「ぼくが かべに なる！」'],
      },
    ],
    chests: [
      { id: 'field3_chest1', x: 3, y: 13, item: 'firstaid', amount: 1, label: 'きゅうきゅうセット' },
    ],
    exits: [
      { x: 7, y: 16, to: 'field4', tx: 7, ty: 2 },
    ],
    encounter: { rate: 0.11, enemies: ['offside_ghost', 'hand_monster'] },
  },

  // ── field4：レイニーピッチ（イツキ加入＝5人・道具屋） ─────────────────
  field4: {
    id: 'field4',
    name: 'レイニーピッチ',
    grid: [
      '################', // r0
      '#......,.......#', // r1
      '#......,.......#', // r2  ← 到着(7,2)
      '#......,.......#', // r3
      '#...~~.,..~~...#', // r4  ← 雨（装飾）
      '#...~~.,..~~...#', // r5
      '#......,.......#', // r6
      '#......,.......#', // r7
      '#......,.......#', // r8  ← イツキ(5,8)／道具屋(11,8)
      '#......,.......#', // r9
      '#......,.......#', // r10
      '#......,.......#', // r11
      '#......,.......#', // r12
      '#......,.......#', // r13 ← 宝箱(12,13)
      '#......,.......#', // r14
      '#......,.......#', // r15
      '#......,.......#', // r16 ← 出口(7,16)
      '################', // r17
    ],
    npcs: [
      {
        x: 5, y: 8, sprite: 'itsuki', joinId: 'itsuki', vanishFlag: 'joined_itsuki',
        pages: [
          'おまたせ！ おれは イツキ。',
          'パスも シュートも おまかせの\nMFさ。これで チームは 5にん だ！',
          'さいごまで いっしょに たたかおう！',
        ],
        afterPages: ['イツキ「ナイスプレー いこうぜ！」'],
      },
      {
        x: 11, y: 8, sprite: 'shopkeep', shop: {
          type: 'item', name: 'どうぐ屋',
          greeting: 'たびの じゅんびは ばっちりかい？',
          items: ['drink', 'jelly', 'firstaid', 'restart_whistle'],
        },
      },
    ],
    chests: [
      { id: 'field4_chest1', x: 12, y: 13, item: 'spike2', amount: 1, label: 'ハヤテスパイク' },
    ],
    exits: [
      { x: 7, y: 16, to: 'field5', tx: 7, ty: 2 },
    ],
    encounter: { rate: 0.12, enemies: ['hand_monster', 'yellowcard_bat'] },
  },

  // ── field5：スカイスタジアム（中ボス：ゴーレムキーパー） ──────────────
  //   r9 が壁の帯（col7 だけ開く）。キーパーが その隙間(7,9)を塞ぐ。
  //   倒すと vanishFlag で消え、下半分へ抜けられる。
  field5: {
    id: 'field5',
    name: 'スカイスタジアム',
    grid: [
      '################', // r0
      '#......,.......#', // r1
      '#......,.......#', // r2  ← 到着(7,2)
      '#......,.......#', // r3
      '#......,.......#', // r4  ← 道具屋(3,4)
      '#......,.......#', // r5  ← 宝箱(11,5)
      '#......,.......#', // r6
      '#......,.......#', // r7
      '#......,.......#', // r8
      '#######.########', // r9  ← 壁の帯・キーパー(7,9)が隙間を塞ぐ
      '#......,.......#', // r10
      '#......,.......#', // r11
      '#......,.......#', // r12
      '#......,.......#', // r13
      '#......,.......#', // r14
      '#......,.......#', // r15
      '#......,.......#', // r16 ← 出口(7,16)
      '################', // r17
    ],
    npcs: [
      {
        x: 7, y: 9, sprite: 'keeper',
        boss: { enemies: ['guardian'], winFlag: 'boss_guardian', vanishFlag: 'boss_guardian' },
        pages: [
          'ゴーレムキーパーが ゆくてを ふさいでいる！',
          '「ここから さきへは とおさん。」',
          '「われを たおせるかな…？」',
        ],
        afterPages: ['たおした キーパーの あとに\nみちが ひらけている。'],
      },
      {
        x: 3, y: 4, sprite: 'shopkeep', shop: {
          type: 'item', name: 'どうぐ屋',
          greeting: 'ボスの まえだ。かいものは いいかい？',
          items: ['drink', 'jelly', 'firstaid', 'restart_whistle'],
        },
      },
    ],
    chests: [
      { id: 'field5_chest1', x: 11, y: 5, item: 'restart_whistle', amount: 1, label: 'さいかいの ホイッスル' },
    ],
    exits: [
      {
        x: 7, y: 16, to: 'field6', tx: 7, ty: 2,
        requireFlag: 'boss_guardian',
        lockedMsg: 'キーパーを たおさないと\nさきへは すすめないようだ…',
      },
    ],
    encounter: { rate: 0.08, enemies: ['yellowcard_bat', 'redcard_devil'] },
  },

  // ── field6：ダークアリーナ（ラスボス：ダーク・カイザー） ──────────────
  field6: {
    id: 'field6',
    name: 'ダークアリーナ',
    grid: [
      '################', // r0
      '#......,.......#', // r1
      '#......,.......#', // r2  ← 到着(7,2)
      '#......,.......#', // r3  ← 道具屋(3,3)
      '#......,.......#', // r4  ← 宝箱(11,4)
      '#......,.......#', // r5
      '#......,.......#', // r6
      '#......,.......#', // r7
      '#......,.......#', // r8
      '#......,.......#', // r9  ← ダーク・カイザー(7,9)
      '#......,.......#', // r10
      '#......,.......#', // r11
      '#......,.......#', // r12
      '#......,.......#', // r13
      '#......,.......#', // r14
      '#......,.......#', // r15
      '#......,.......#', // r16
      '################', // r17
    ],
    npcs: [
      {
        x: 7, y: 9, sprite: 'kaiser',
        boss: { enemies: ['dark_kaiser'], winFlag: 'boss_kaiser', vanishFlag: 'boss_kaiser', ending: true },
        pages: [
          'ダーク・カイザーが まちかまえていた！',
          '「おうごんの ボールは わたさん！」',
          '「この ダーク・カイザーが\nあいてだ！ かかってこい！」',
        ],
        afterPages: ['…もう たたかう あいては いない。'],
      },
      {
        x: 3, y: 3, sprite: 'shopkeep', shop: {
          type: 'item', name: 'どうぐ屋',
          greeting: 'さいごの たたかいだ。じゅんびは いいか？',
          items: ['drink', 'jelly', 'firstaid', 'restart_whistle'],
        },
      },
    ],
    chests: [
      { id: 'field6_chest1', x: 11, y: 4, item: 'firstaid', amount: 1, label: 'きゅうきゅうセット' },
    ],
    exits: [],
    encounter: { rate: 0.10, enemies: ['redcard_devil', 'yellowcard_bat'] },
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
