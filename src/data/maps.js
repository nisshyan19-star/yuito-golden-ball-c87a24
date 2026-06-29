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
  // 隠し通路（弾3）：見た目は壁(t_wall)と同じだが歩ける。当たって初めて気づく。
  'H': { sprite: 't_wall',  walkable: true, secret: true }, // かくし通路（壁にまぎれた抜け道）
};

// ── マップ集 ─────────────────────────────────────────────────────────
//   grid は各行ぴったり16文字・18行。座標はタイル座標 (x=列, y=行)。
var MAPS = {
  // ── field1：はじまりの草原（ユイト出発・イクマ加入・道具屋） ──────────
  //   ※ grid と (4,9)NPC・宝箱(12,13) は field.test.js が固定。改変禁止。
  field1: {
    id: 'field1',
    name: 'はじまりの草原',
    // オープニング・カットシーン（弾4）：ゲーム開始＝field1 入場で一度だけ流れる。
    cutscene: {
      flag: 'cs_intro',
      pages: [
        '―― ピッチランド。\nサッカーが だいすきな\nみんなの まち。',
        'ある ひ、たからものの\n「おうごんの サッカーボール」が\nぬすまれて しまった。',
        'ぬすんだのは やみの ていおう\nダーク・カイザー！',
        'ボールが きえると\nまちの えがおも きえていく……',
        'しょうねん ユイトは たちあがった。\n「ぼくが とりもどす！」',
      ],
    },
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
          'やあ ユイト！ おれは イクマ。\nまちいちばんの ストライカーさ。',
          'スピードと シュートなら まけない\nFW（フォワード）だ！',
          'カイザーに ボールを ぬすまれて\nおれも くやしかったんだ。',
          'いっしょに とりもどそうぜ！\nユイトと なら やれる きがする！',
        ],
        afterPages: ['イクマ「スピードで かけぬけるぜ！」'],
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
    // 飾りオブジェクト（grid とは別レイヤ。solid:true は通行不可）。
    // ※テスト固定の (5,5)/(3,2) と中央の道(col7)・NPC/宝箱マスは避ける。
    objects: [
      { x: 1,  y: 1,  type: 'tree',   solid: true },
      { x: 14, y: 1,  type: 'tree',   solid: true },
      { x: 10, y: 5,  type: 'ball'   },
      { x: 1,  y: 7,  type: 'flower' },
      { x: 14, y: 7,  type: 'flower' },
      { x: 2,  y: 9,  type: 'sign',   solid: true },
      { x: 2,  y: 13, type: 'bush',   solid: true },
      { x: 10, y: 13, type: 'goal',   solid: true },
    ],
    exits: [
      { x: 7, y: 16, to: 'town1', tx: 7, ty: 2 },
    ],
    encounter: { rate: 0.045, enemies: ['foul_goblin', 'offside_ghost', 'mud_slime'], rare: { rate: 0.05, enemies: ['golden_ball'] } },
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
          'チームの 司令塔、ゲームを くみたてる\nMF（ミッドフィルダー）だ。',
          'いい パスを だす じしんが ある。\nテクニックなら まかせてくれ！',
          'きみの たたかいに\nおれの パスを くわえさせてくれ！',
        ],
        afterPages: ['アオシ「パスで みんなを いかすぜ！」'],
      },
      {
        x: 11, y: 8, sprite: 'shopkeep', shop: {
          type: 'equip', name: 'そうび屋',
          greeting: 'いい スパイクが あるよ！',
          items: ['spike1', 'spike2', 'uni1', 'uni2'],
        },
      },
      // ギミックの案内人（弾2）：動く床（ベルトコンベア）のヒント。
      {
        x: 9, y: 11, sprite: 'coach',
        pages: [
          'スタジアムの まんなかの みちは\n「うごく ゆか」に なっているんだ。',
          'のると かってに したへ ながされる！\nよこに よければ もどれるよ。',
        ],
      },
    ],
    chests: [
      { id: 'field2_chest1', x: 12, y: 11, item: 'jelly', amount: 1, label: 'スタミナゼリー' },
    ],
    objects: [
      { x: 3,  y: 1,  type: 'goal',   solid: true },
      { x: 11, y: 1,  type: 'goal',   solid: true },
      { x: 5,  y: 6,  type: 'ball'   },
      { x: 9,  y: 6,  type: 'ball'   },
      { x: 1,  y: 8,  type: 'bench',  solid: true },
      { x: 14, y: 8,  type: 'bench',  solid: true },
      { x: 2,  y: 12, type: 'sign',   solid: true },
      { x: 5,  y: 14, type: 'flower' },
      { x: 10, y: 14, type: 'flower' },
    ],
    // 動く床（弾2）：まんなかの道(col7)を下へ流す。横(col6/col8)によければ戻れる。
    conveyors: [
      { x: 7, y: 12, dir: 'down' },
      { x: 7, y: 13, dir: 'down' },
      { x: 7, y: 14, dir: 'down' },
    ],
    exits: [
      { x: 7, y: 16, to: 'field3', tx: 7, ty: 2 },
    ],
    encounter: { rate: 0.05, enemies: ['foul_goblin', 'offside_ghost', 'mud_slime', 'corner_crow'], rare: { rate: 0.05, enemies: ['golden_ball'] } },
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
          'ぼくは トモキ。\nまもりの かなめ、DF（ディフェンダー）だ。',
          'からだを はって なかまを まもるのが\nぼくの やくめ なんだ。',
          'カイザーの てしたに まちを あらされて\nだまって いられない。',
          'ぼくの まもりを\nきみたちに あずけさせて！',
        ],
        afterPages: ['トモキ「ぼくが かべに なる！」'],
      },
      // ギミックの案内人（弾2）：押しブロック（サッカーボール）のヒント。
      {
        x: 13, y: 9, sprite: 'coach',
        pages: [
          'おおきな ボールを\nおして うごかせるの しってた？',
          'ひかる ▢マークまで ボールを\nはこぶと… いいこと あるかもよ！',
        ],
      },
    ],
    chests: [
      { id: 'field3_chest1', x: 3, y: 13, item: 'firstaid', amount: 1, label: 'きゅうきゅうセット' },
      // 倉庫番パズルを解くと開くボーナス宝箱（弾2）。
      { id: 'field3_chest2', x: 13, y: 11, item: 'firstaid', amount: 2, label: 'きゅうきゅうセット', requireFlag: 'field3_puzzle', lockedMsg: 'カギが かかっている。\nどこかの しかけと かんけいが ありそうだ…' },
    ],
    objects: [
      { x: 1,  y: 1,  type: 'tree',   solid: true },
      { x: 14, y: 1,  type: 'tree',   solid: true },
      { x: 2,  y: 3,  type: 'bush',   solid: true },
      { x: 13, y: 3,  type: 'bush',   solid: true },
      { x: 6,  y: 6,  type: 'ball'   },
      { x: 9,  y: 10, type: 'ball'   },
      { x: 12, y: 8,  type: 'sign',   solid: true },
      { x: 1,  y: 13, type: 'flower' },
      { x: 13, y: 13, type: 'flower' },
      { x: 10, y: 14, type: 'goal',   solid: true },
    ],
    // 倉庫番パズル（弾2）：ボールを ▢ ゴールまで押すと宝箱が開く。
    pushBlocks: [ { x: 11, y: 11 } ],
    pushGoals:  [ { x: 11, y: 13 } ],
    pushPuzzle: { solveFlag: 'field3_puzzle', clearMsg: 'ガコン！ どこかで\nたからばこの カギが はずれた おとが した！' },
    exits: [
      { x: 7, y: 16, to: 'town2', tx: 7, ty: 2 },
    ],
    encounter: { rate: 0.055, enemies: ['offside_ghost', 'hand_monster', 'corner_crow', 'throwin_golem'], rare: { rate: 0.05, enemies: ['golden_ball'] } },
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
          'おまたせ！ おれは イツキ。\nゴールマウスを まもる GK だ。',
          'どんな シュートも とめてみせる。\n「守護神」と よばれてるんだ。',
          'これで メンバーは 5にん。\nさいきょうの チームの かんせい だ！',
          'おれの セーブで\nぜったいに まけさせない！',
        ],
        afterPages: ['イツキ「うしろは まかせろ！」'],
      },
      {
        x: 11, y: 8, sprite: 'shopkeep', shop: {
          type: 'item', name: 'どうぐ屋',
          greeting: 'たびの じゅんびは ばっちりかい？',
          items: ['drink', 'jelly', 'firstaid', 'restart_whistle'],
        },
      },
      // ギミックの案内人（弾2）：ワープパネルのヒント。
      {
        x: 3, y: 6, sprite: 'coach',
        pages: [
          'むらさきに ひかる パネルが\nコートの すみに あるんだ。',
          'のると いっしゅんで\nはんたいがわへ ワープするぞ！',
        ],
      },
    ],
    chests: [
      { id: 'field4_chest1', x: 12, y: 13, item: 'spike2', amount: 1, label: 'ハヤテスパイク' },
    ],
    objects: [
      { x: 1,  y: 1,  type: 'tree',   solid: true },
      { x: 14, y: 1,  type: 'tree',   solid: true },
      { x: 2,  y: 3,  type: 'sign',   solid: true },
      { x: 13, y: 3,  type: 'bush',   solid: true },
      { x: 6,  y: 6,  type: 'ball'   },
      { x: 8,  y: 10, type: 'ball'   },
      { x: 1,  y: 8,  type: 'bench',  solid: true },
      { x: 14, y: 11, type: 'bench',  solid: true },
      { x: 3,  y: 13, type: 'flower' },
      { x: 10, y: 14, type: 'goal',   solid: true },
    ],
    // ワープパネル（弾2）：左右の すみを つなぐ 近道テレポート（同一マップ）。
    warps: [
      { x: 1,  y: 5, tx: 13, ty: 9 },
      { x: 14, y: 9, tx: 2,  ty: 5 },
    ],
    exits: [
      { x: 7, y: 16, to: 'field5', tx: 7, ty: 2 },
    ],
    encounter: { rate: 0.06, enemies: ['hand_monster', 'yellowcard_bat', 'throwin_golem', 'losstime_ghost'], rare: { rate: 0.05, enemies: ['metal_keeper'] } },
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
    // ※ r9 の壁の帯と唯一の通路(7,9)は絶対に塞がない（col7 と r9 は避ける）。
    objects: [
      { x: 11, y: 1,  type: 'goal',   solid: true },
      { x: 5,  y: 2,  type: 'ball'   },
      { x: 1,  y: 4,  type: 'bench',  solid: true },
      { x: 13, y: 7,  type: 'sign',   solid: true },
      { x: 2,  y: 11, type: 'goal',   solid: true },
      { x: 13, y: 11, type: 'bench',  solid: true },
      { x: 9,  y: 12, type: 'ball'   },
      { x: 4,  y: 14, type: 'flower' },
      { x: 11, y: 14, type: 'flower' },
    ],
    exits: [
      {
        x: 7, y: 16, to: 'town3', tx: 7, ty: 2,
        requireFlag: 'boss_guardian',
        lockedMsg: 'キーパーを たおさないと\nさきへは すすめないようだ…',
      },
    ],
    encounter: { rate: 0.04, enemies: ['yellowcard_bat', 'redcard_devil', 'losstime_ghost', 'trick_fox'], rare: { rate: 0.05, enemies: ['metal_keeper'] } },
  },

  // ── field6：ダークアリーナ（ラスボス：ダーク・カイザー＋弾3 かくし部屋） ──
  //   左下に かくし部屋。col4(r13)='H' は 見た目は壁だが あるける かくし通路。
  //   かくし部屋(cols1-3,rows12-14)に 隠しボス＝ファントム・ストライカーと
  //   ごほうびの宝箱。右の(12,5)宝箱は スイッチ(12,8)で ひらく しかけ。
  field6: {
    id: 'field6',
    name: 'ダークアリーナ',
    // 決戦まえ・カットシーン（弾4）：ダークアリーナ入場で一度だけ流れる。
    //   仲間の演出は序盤で必ず加入する イクマ・アオシ に限定（未加入でも矛盾しない）。
    cutscene: {
      flag: 'cs_field6',
      pages: [
        'くらい アリーナ。\nここに ダーク・カイザーが\nいる――。',
        'ユイト「ついに ここまで きた。\nみんな、ありがとう。」',
        'イクマ「なに いってんだ、\nさいごまで いっしょだろ！」',
        'アオシ「いくぞ ユイト。\nボールを とりもどすんだ！」',
        'ユイトは うなずいた。\n「いくぞ ――けっせんだ！」',
      ],
    },
    grid: [
      '################', // r0
      '#......,.......#', // r1
      '#......,.......#', // r2  ← 到着(7,2)
      '#......,.......#', // r3  ← 道具屋(3,3)
      '#......,.......#', // r4  ← 宝箱(11,4)
      '#......,.......#', // r5  ← しかけ宝箱(12,5)
      '#......,.......#', // r6
      '#......,.......#', // r7
      '#......,.......#', // r8  ← スイッチ(12,8)
      '#......,.......#', // r9  ← ダーク・カイザー(7,9)
      '#......,.......#', // r10
      '#####..,.......#', // r11 ← かくし部屋 上の壁
      '#...#..,.......#', // r12 ← 宝箱(1,12)／col4=壁
      '#...H..,.......#', // r13 ← (4,13)=H かくし通路／隠しボス(2,13)
      '#...#..,.......#', // r14 ← col4=壁
      '#####..,.......#', // r15 ← かくし部屋 下の壁
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
      // 仕掛け（弾3）：ふるびた スイッチ。おすと 右の(12,5)宝箱が ひらく。
      {
        x: 12, y: 8, sprite: 'coach',
        lever: {
          flag: 'lever_field6',
          onPages: [
            'ふるびた スイッチが ある…\nおして みた。',
            'ガコン！\nどこかで とびらが ひらく おとが した！',
          ],
          donePages: ['スイッチは もう おされている。'],
        },
      },
      // 隠しボス（弾3）：かくし部屋に いる まぼろしの ストライカー。
      {
        x: 2, y: 13, sprite: 'kaiser',
        boss: {
          enemies: ['phantom_striker'],
          winFlag: 'boss_phantom', vanishFlag: 'boss_phantom',
          reward: { item: 'phantom_cleats', amount: 1, label: 'まぼろしのスパイク' },
        },
        pages: [
          'うすやみの なかに\nまぼろしの ストライカーが たっていた…',
          '「ここまで たどりついた とは。」',
          '「うけて みろ ―― おれの ぜんりょくを！」',
        ],
        afterPages: ['まぼろしの ストライカーは きえさった。'],
      },
    ],
    chests: [
      { id: 'field6_chest1', x: 11, y: 4, item: 'firstaid', amount: 1, label: 'きゅうきゅうセット' },
      // 隠し部屋の ごほうび（弾3・宝）
      { id: 'field6_hidden', x: 1, y: 12, item: 'restart_whistle', amount: 2, label: 'リスタートの笛' },
      // スイッチ(12,8)で ひらく 宝箱（弾3・仕掛け）
      {
        id: 'field6_locked', x: 12, y: 5, item: 'uni3', amount: 1, label: 'おうごんユニフォーム',
        requireFlag: 'lever_field6',
        lockedMsg: 'がっちり ロックされている。\nどこかに スイッチが ありそうだ…',
      },
    ],
    objects: [
      { x: 2,  y: 1,  type: 'tree',   solid: true },
      { x: 13, y: 1,  type: 'tree',   solid: true },
      { x: 11, y: 3,  type: 'goal',   solid: true },
      { x: 5,  y: 6,  type: 'ball'   },
      { x: 1,  y: 8,  type: 'sign',   solid: true },
      { x: 14, y: 8,  type: 'bench',  solid: true },
      { x: 11, y: 15, type: 'goal',   solid: true },
      { x: 12, y: 12, type: 'ball'   },
      { x: 6,  y: 14, type: 'flower' },
      { x: 9,  y: 14, type: 'flower' },
    ],
    // ボスラッシュ「ちょうせんの間」（追加弾4-D）：ラスボス撃破後に ひらく 南の とびら。
    //   到着は (7,15)＝とびら(7,16)の1つ上ではなく、もどりワープで (7,13) に着地させ
    //   即・再突入ループにならないようにする（exit は正面タイル判定）。
    exits: [
      {
        x: 7, y: 16, to: 'challenge_room', tx: 7, ty: 15,
        requireFlag: 'boss_kaiser',
        lockedMsg: 'おもい とびらだ。\nダーク・カイザーを たおすと ひらくらしい…',
      },
    ],
    encounter: { rate: 0.05, enemies: ['redcard_devil', 'trick_fox', 'stamina_zombie', 'pk_punisher'], rare: { rate: 0.05, enemies: ['metal_keeper'] } },
  },

  // ══════════════════════════════════════════════════════════════════════
  //  町（弾2）：戦闘なし(encounter.rate=0)・お店/宿屋/サブクエスト。
  //  どの町も同じ安全グリッド：中央 col7 が道、到着(7,2)・出口(7,16)。
  //  NPC/宝箱は歩けるマス(F or .)にのみ配置。F=石だたみ広場（歩ける）。
  // ══════════════════════════════════════════════════════════════════════

  // ── town1：ハーバータウン（field1 と field2 のあいだ・港町） ───────────
  town1: {
    id: 'town1',
    name: 'ハーバータウン',
    isTown: true,
    grid: [
      '################', // r0
      '#......,.......#', // r1
      '#......,.......#', // r2  ← 到着(7,2)
      '#..FFF.,.FFF...#', // r3
      '#..FFF.,.FFF...#', // r4  ← どうぐ屋(3,4)／やどや(11,4)
      '#..FFF.,.FFF...#', // r5
      '#......,.......#', // r6
      '#......,.......#', // r7
      '#......,.......#', // r8  ← クエスト主(4,8)／ボールを ひろった子(11,8)
      '#......,.......#', // r9
      '#......,.......#', // r10
      '#..FFF.,.FFF...#', // r11
      '#..FFF.,.FFF...#', // r12 ← まちの人(4,12)／宝箱(11,12)
      '#..FFF.,.FFF...#', // r13
      '#......,.......#', // r14
      '#......,.......#', // r15
      '#......,.......#', // r16 ← 出口(7,16)
      '################', // r17
    ],
    npcs: [
      {
        x: 3, y: 4, sprite: 'shopkeep', shop: {
          type: 'item', name: 'どうぐ屋',
          greeting: 'みなとまちへ ようこそ！ かいものかい？',
          items: ['drink', 'jelly', 'firstaid', 'restart_whistle'],
        },
      },
      {
        x: 11, y: 4, sprite: 'shopkeep', shop: {
          type: 'inn', name: 'やどや', cost: 20,
          greeting: 'やどやだよ。やすんで いくかい？',
        },
      },
      {
        x: 4, y: 8, sprite: 'coach',
        quest: {
          acceptFlag: 'q1_accept', itemFlag: 'q1_item', doneFlag: 'q1_done',
          reward: { gold: 50, item: 'drink', amount: 2, label: 'スポーツドリンク' },
          askPages: [
            'うちの子が だいじな サッカーボールを\nなくして ないているんだ…',
            'みなとに ボールを ひろった人が いるらしい。\nうけとって きて くれないか？',
          ],
          waitPages: ['みなとの 子に はなしかけて\nボールを うけとって おくれ。'],
          clearPages: [
            'おお！ それは うちの子の ボールだ！',
            'ほんとうに ありがとう！\nこれは おれいだよ。',
          ],
          donePages: ['この まえは ありがとう！\nうちの子も よろこんでいたよ。'],
        },
        pages: ['うちの子が ボールを なくして…'],
      },
      {
        x: 11, y: 8, sprite: 'coach',
        give: {
          itemFlag: 'q1_item', requireFlag: 'q1_accept',
          pages: [
            'ん？ この サッカーボール かい？',
            'みなとで ひろったんだ。\nもちぬしに とどけて あげてね。はい どうぞ！',
          ],
          gotPages: ['もちぬしに とどけて あげてね。'],
          idlePages: ['いい てんきだなあ。\nうみが きらきら ひかってる。'],
        },
        pages: ['いい てんきだなあ。'],
      },
      {
        x: 4, y: 12, sprite: 'shopkeep',
        pages: [
          'ここは ハーバータウン。',
          'やどやで やすめば\nHPも スタミナも ぜんかいするよ！',
        ],
      },
      // 隠しエリアの案内人（弾2）：ひかる ゆかのウワサ。
      {
        x: 13, y: 6, sprite: 'shopkeep',
        pages: [
          'しってるかい？ このまちの すみに\n「ひかる ゆか」が あるって ウワサ…',
          'のると どこかへ ワープして\nすごい おたからが もらえるとか もらえないとか！',
        ],
      },
    ],
    chests: [
      { id: 'town1_chest1', x: 11, y: 12, item: 'jelly', amount: 1, label: 'スタミナゼリー' },
    ],
    objects: [
      { x: 1,  y: 1,  type: 'tree',   solid: true },
      { x: 14, y: 1,  type: 'tree',   solid: true },
      { x: 2,  y: 4,  type: 'bench',  solid: true },
      { x: 13, y: 4,  type: 'bench',  solid: true },
      { x: 5,  y: 5,  type: 'ball'   },
      { x: 9,  y: 5,  type: 'ball'   },
      { x: 10, y: 8,  type: 'sign',   solid: true },
      { x: 2,  y: 12, type: 'flower' },
      { x: 13, y: 12, type: 'flower' },
    ],
    // 隠しエリアへのワープパネル（弾2）：ひみつのトレーニングルームへ。
    warps: [
      { x: 13, y: 8, to: 'secret_field', tx: 7, ty: 3, msg: 'ひかる ゆかに のった！\nまばゆい ひかりに つつまれる…' },
    ],
    exits: [
      { x: 7, y: 16, to: 'field2', tx: 7, ty: 2 },
    ],
    encounter: { rate: 0, enemies: [] },
  },

  // ── town2：フォレストタウン（field3 と field4 のあいだ・森の町） ────────
  town2: {
    id: 'town2',
    name: 'フォレストタウン',
    isTown: true,
    grid: [
      '################', // r0
      '#......,.......#', // r1
      '#......,.......#', // r2  ← 到着(7,2)
      '#..FFF.,.FFF...#', // r3
      '#..FFF.,.FFF...#', // r4  ← そうび屋(3,4)／やどや(11,4)
      '#..FFF.,.FFF...#', // r5
      '#......,.......#', // r6
      '#......,.......#', // r7
      '#......,.......#', // r8  ← クエスト主(4,8)／おべんとうの子(11,8)
      '#......,.......#', // r9
      '#......,.......#', // r10
      '#..FFF.,.FFF...#', // r11
      '#..FFF.,.FFF...#', // r12 ← まちの人(4,12)／宝箱(11,12)
      '#..FFF.,.FFF...#', // r13
      '#......,.......#', // r14
      '#......,.......#', // r15
      '#......,.......#', // r16 ← 出口(7,16)
      '################', // r17
    ],
    npcs: [
      {
        x: 3, y: 4, sprite: 'shopkeep', shop: {
          type: 'equip', name: 'そうび屋',
          greeting: 'もりの かじやだ。いい そうびが あるよ。',
          items: ['spike1', 'spike2', 'uni1', 'uni2'],
        },
      },
      {
        x: 11, y: 4, sprite: 'shopkeep', shop: {
          type: 'inn', name: 'やどや', cost: 25,
          greeting: 'もりの やどやへ ようこそ。やすむかい？',
        },
      },
      {
        x: 4, y: 8, sprite: 'coach',
        quest: {
          acceptFlag: 'q2_accept', itemFlag: 'q2_item', doneFlag: 'q2_done',
          reward: { gold: 80, item: 'jelly', amount: 2, label: 'スタミナゼリー' },
          askPages: [
            'むすこが もりで れんしゅう しているんだ。',
            'おべんとうを わすれて いってね…\nだれかに もたせたから、とどけて くれるかい？',
          ],
          waitPages: ['もりの 子から おべんとうを\nうけとって、むすこに とどけてね。'],
          clearPages: [
            'おお！ おべんとうを とどけて くれたんだね！',
            'むすこも おなかぺこぺこ だったろう。\nたすかったよ、これは おれいだ！',
          ],
          donePages: ['おべんとう ありがとう！\nむすこも げんきに れんしゅう してるよ。'],
        },
        pages: ['むすこが おべんとうを わすれてね…'],
      },
      {
        x: 11, y: 8, sprite: 'coach',
        give: {
          itemFlag: 'q2_item', requireFlag: 'q2_accept',
          pages: [
            'この おべんとう かい？',
            'むすこさんに たのまれて あずかってたんだ。\nもっていって あげて。はい どうぞ！',
          ],
          gotPages: ['むすこさんに とどけて あげてね。'],
          idlePages: ['もりの きは きもちが いいね。'],
        },
        pages: ['もりの きは きもちが いいね。'],
      },
      {
        x: 4, y: 12, sprite: 'shopkeep',
        pages: [
          'ここは フォレストタウン。',
          'そうび屋で つよい スパイクを\nそろえると たたかいが らくになるよ！',
        ],
      },
      // PKコーチ（追加弾3・ミニゲーム）：話すと PK戦（5本勝負）に ちょうせんできる。
      {
        x: 4, y: 14, sprite: 'coach',
        pk: {
          winFlag: 'pk_master',
          reward: { gold: 300, item: 'jelly', amount: 5, label: 'エナジーゼリー5こ' },
        },
        pages: [
          'やあ！ おれは PKコーチだ。',
          'PKせんで しょうぶ しないか？\n5本ちゅう 3本 きめたら きみの かち！',
          'ねらいを さだめて シュート！\nさあ ちょうせん してみよう！',
        ],
        afterPages: ['また PKせんで あそぼう！\nうでが なまらないように な。'],
      },
      // サッカー トーナメント（追加弾5-C）：PKを せいはした人が ちょうせんできる 3チーム勝ち抜き。ゆうしょうで トロフィー。
      {
        x: 11, y: 14, sprite: 'coach',
        tournament: {
          winFlag: 'tournament_champion', requireFlag: 'pk_master',
          reward: { gold: 800, item: 'champ_ball', amount: 1, label: 'ゆうしょうボール' },
        },
        pages: [
          'ようこそ、サッカー トーナメントへ！',
          '3チームを じゅんに たおせば ゆうしょうだ。',
          'シュートも キーパーも きみの うでしだい！\nさあ、ちょうせん するか？',
        ],
        afterPages: ['また トーナメントに ちょうせん するかい？\nうでが なるだろう！'],
        lockedPages: [
          'ここは つよい チームが あつまる トーナメント。',
          'まずは PKコーチで うでを みがいてから\nまた おいで！',
        ],
      },
    ],
    chests: [
      { id: 'town2_chest1', x: 11, y: 12, item: 'firstaid', amount: 1, label: 'きゅうきゅうセット' },
    ],
    objects: [
      { x: 1,  y: 1,  type: 'tree',   solid: true },
      { x: 14, y: 1,  type: 'tree',   solid: true },
      { x: 2,  y: 4,  type: 'bush',   solid: true },
      { x: 13, y: 4,  type: 'bush',   solid: true },
      { x: 5,  y: 5,  type: 'flower' },
      { x: 9,  y: 5,  type: 'flower' },
      { x: 10, y: 8,  type: 'sign',   solid: true },
      { x: 2,  y: 12, type: 'tree',   solid: true },
      { x: 13, y: 12, type: 'tree',   solid: true },
      { x: 5,  y: 14, type: 'ball' }, // PKコーチの足もとのボール（飾り・歩ける）
    ],
    exits: [
      { x: 7, y: 16, to: 'field4', tx: 7, ty: 2 },
    ],
    encounter: { rate: 0, enemies: [] },
  },

  // ── town3：クラウドタウン（field5 と field6 のあいだ・決戦まえの空の町） ─
  town3: {
    id: 'town3',
    name: 'クラウドタウン',
    isTown: true,
    // 最後の町・カットシーン（弾4）：決戦まえの しずかな ひとときを 一度だけ。
    cutscene: {
      flag: 'cs_town3',
      pages: [
        'くもの うえの まち、\nクラウドタウン。\nこの さきは けっせんだ。',
        'みなと そらを みあげる。\nどこかで ボールの おとが\nきこえた きが した。',
        'ユイト「あと すこしだ。\nぜったいに とりもどす。」',
      ],
    },
    grid: [
      '################', // r0
      '#......,.......#', // r1
      '#......,.......#', // r2  ← 到着(7,2)
      '#..FFF.,.FFF...#', // r3
      '#..FFF.,.FFF...#', // r4  ← どうぐ屋(3,4)／やどや(11,4)
      '#..FFF.,.FFF...#', // r5
      '#......,.......#', // r6
      '#......,.......#', // r7
      '#......,.......#', // r8  ← クエスト主(4,8)／おまもりの子(11,8)
      '#......,.......#', // r9
      '#......,.......#', // r10
      '#..FFF.,.FFF...#', // r11
      '#..FFF.,.FFF...#', // r12 ← まちの人(4,12)／宝箱(11,12)
      '#..FFF.,.FFF...#', // r13
      '#......,.......#', // r14
      '#......,.......#', // r15
      '#......,.......#', // r16 ← 出口(7,16)
      '################', // r17
    ],
    npcs: [
      {
        x: 3, y: 4, sprite: 'shopkeep', shop: {
          type: 'item', name: 'どうぐ屋',
          greeting: 'けっせんの まえだ。じゅうぶん そなえて いきな！',
          items: ['drink', 'jelly', 'firstaid', 'restart_whistle'],
        },
      },
      {
        x: 11, y: 4, sprite: 'shopkeep', shop: {
          type: 'inn', name: 'やどや', cost: 30,
          greeting: 'さいごの やすみどころだよ。ゆっくり しな。',
        },
      },
      {
        x: 4, y: 8, sprite: 'coach',
        quest: {
          acceptFlag: 'q3_accept', itemFlag: 'q3_item', doneFlag: 'q3_done',
          reward: { gold: 120, item: 'restart_whistle', amount: 1, label: 'さいかいの ホイッスル' },
          askPages: [
            'これから ダーク・カイザーと たたかうんだね。',
            'まちに しあわせを よぶ「きぼうの おまもり」が あるんだ。',
            'もっている子が いる。うけとって もっていきな。\nきっと きみたちを まもって くれる。',
          ],
          waitPages: ['まちの 子から「きぼうの おまもり」を\nうけとって きておくれ。'],
          clearPages: [
            'おお、おまもりを てに いれたんだね。',
            'それが あれば だいじょうぶ。\nおれいに これを もっていきな！',
          ],
          donePages: ['きぼうの おまもりが\nきみたちを まもって くれるよ。'],
        },
        pages: ['きぼうの おまもりを さがして おいで。'],
      },
      {
        x: 11, y: 8, sprite: 'coach',
        give: {
          itemFlag: 'q3_item', requireFlag: 'q3_accept',
          pages: [
            'きぼうの おまもりを さがしてるの?',
            'これだよ。みんなの ねがいが こもってる。\nもっていって！ はい どうぞ！',
          ],
          gotPages: ['おまもりが きみを まもるよ。\nがんばって！'],
          idlePages: ['くもの うえの まちは\nそらが とっても ちかいんだ。'],
        },
        pages: ['そらが とっても ちかいんだ。'],
      },
      {
        x: 4, y: 12, sprite: 'coach',
        pages: [
          'ここは クラウドタウン。さいごの まちだ。',
          'やどやで かいふくして\nどうぐも そろえて、けっせんに そなえよう！',
          'きみたちなら きっと かてる。おうえん してるよ！',
        ],
      },
      // でんせつの とびら 案内（追加弾3）：右の ひかる ゆかが 隠しダンジョンへの入口。
      {
        x: 13, y: 6, sprite: 'coach',
        pages: [
          'みぎの ひかる ゆかは\n「でんせつの アリーナ」への とびらだ。',
          'そこには さいきょうの エース、\nゴールド・エンペラーが ねむっている…',
          'よほど つよく ないと たちうちできない。\nじしんが ついたら いどんで みな！',
        ],
      },
      // かじや（追加弾5-D）：てきの おとす そざいで そうびを ごうせい できる。
      {
        x: 4, y: 10, sprite: 'shopkeep',
        forge: {
          name: 'かじや',
          greeting: 'てきが おとす そざいを もってきな。\nつよい そうびに きたえて やるぜ！',
        },
      },
      // かじや 案内（追加弾5-D）：そざい あつめの ヒント。
      {
        x: 11, y: 10, sprite: 'coach',
        pages: [
          'まちの かじやは\nそざいを そうびに かえて くれるよ。',
          'てきを たおすと「そざい」が\nてに はいることが あるんだ。',
          'ボスや レアな てきは\nレアな そざいを おとすらしいよ！',
        ],
      },
      // 第2章 入口 案内（追加弾5-A）：きたの とびらの さきに 新たな やみが…。
      //   中央の道(col7)上の (7,6) に配置（既存NPCと座標が衝突しない）。
      {
        x: 7, y: 6, sprite: 'coach',
        pages: [
          'きたの そらが\nくろく ざわめいている…',
          'ダーク・カイザーを たおしてから\nやみの きはいが よみがえったんだ。',
          'まちの きたの とびらの さきに\nなにかが いる。きを つけて いきな。',
        ],
      },
    ],
    chests: [
      { id: 'town3_chest1', x: 11, y: 12, item: 'restart_whistle', amount: 1, label: 'さいかいの ホイッスル' },
    ],
    objects: [
      { x: 1,  y: 1,  type: 'goal',   solid: true },
      { x: 14, y: 1,  type: 'goal',   solid: true },
      { x: 2,  y: 4,  type: 'flower' },
      { x: 13, y: 4,  type: 'flower' },
      { x: 5,  y: 5,  type: 'ball'   },
      { x: 9,  y: 5,  type: 'ball'   },
      { x: 10, y: 8,  type: 'sign',   solid: true },
      { x: 2,  y: 12, type: 'flower' },
      { x: 13, y: 12, type: 'flower' },
    ],
    // でんせつの アリーナ 入口ワープ（追加弾3）：右(13,8)→ legend_arena(7,15)。
    warps: [
      { x: 13, y: 8, to: 'legend_arena', tx: 7, ty: 15, msg: 'でんせつの とびらが ひらいた…\nまばゆい ひかりに つつまれる！' },
    ],
    exits: [
      { x: 7, y: 16, to: 'field6', tx: 7, ty: 2 },
      // 第2章 入口（追加弾5-A）：きたの とびら→ ch2_gate。カイザー撃破で ひらく。
      {
        x: 7, y: 1, to: 'ch2_gate', tx: 7, ty: 15,
        requireFlag: 'boss_kaiser',
        lockedMsg: 'きたの とびらは かたく とざされている。\nダーク・カイザーを たおすと\nひらくのかも しれない…',
      },
    ],
    encounter: { rate: 0, enemies: [] },
  },

  // ══════════════════════════════════════════════════════════════════════
  //  secret_field（弾2）：ひみつのトレーニングルーム＝全ギミック総合エリア。
  //  町(town1)の「ひかる ゆか」ワープから来る隠し部屋。dark=たいまつ視界。
  //  ・上半分：動く床のデモ＋倉庫番パズル(2個)→ ゴールデンスパイク
  //  ・下半分：3つの とびらの なぞなぞ門 → まんなか正解で おうごんユニフォーム
  //  戦闘なし(encounter.rate=0/レア枠なし)。帰りは右上(13,2)のワープで町へ。
  // ══════════════════════════════════════════════════════════════════════
  secret_field: {
    id: 'secret_field',
    name: 'ひみつのトレーニングルーム',
    dark: true,
    grid: [
      '################', // r0
      '#FFFFFFFFFFFFFF#', // r1
      '#FFFFFFFFFFFFFF#', // r2  ← 帰りワープ(13,2)
      '#FFFFFFFFFFFFFF#', // r3  ← 到着(7,3)／案内(5,3)
      '#FFFFFFFFFFFFFF#', // r4
      '#FFFFFFFFFFFFFF#', // r5  ← 動く床の案内(10,5)
      '#FFFFFFFFFFFFFF#', // r6  ← 動く床(9〜12,6 左へ)
      '#FFFFFFFFFFFFFF#', // r7
      '#FFFFFFFFFFFFFF#', // r8  ← ボール(2,8)(4,8)／案内(6,8)
      '#FFFFFFFFFFFFFF#', // r9
      '#FFFFFFFFFFFFFF#', // r10 ← ▢ゴール(2,10)(4,10)
      '#FFFFFFFFFFFFFF#', // r11 ← ほうび宝箱(6,11)
      '#FFFFFFFFFFFFFF#', // r12 ← なぞなぞ案内(9,12)
      '####F##F##F#####', // r13 ← とびら x4 / x7 / x10
      '#FFFFFFFFFFFFFF#', // r14 ← もどしワープ(4,14)(10,14)
      '#FFFFFFFFFFFFFF#', // r15 ← なぞなぞ宝箱(7,15)
      '#FFFFFFFFFFFFFF#', // r16
      '################', // r17
    ],
    npcs: [
      {
        x: 5, y: 3, sprite: 'coach',
        pages: [
          'ようこそ！ ここは ひみつの\nトレーニングルームだ。',
          'くらいけど こわくないよ。\nひかる しかけを てがかりに すすもう！',
          'パズルを クリアして\nおたからを てに いれるんだ！',
        ],
      },
      {
        x: 10, y: 5, sprite: 'coach',
        pages: [
          'した の あおい ベルトは「うごく ゆか」。',
          'のると ひだりへ ながされるぞ。\nスピードかんを たのしんで！',
        ],
      },
      {
        x: 6, y: 8, sprite: 'coach',
        pages: [
          'しろい ボールを おして\nひかる ▢マークまで はこぼう。',
          '2つ とも そろえると\nたからばこの カギが あくぞ！',
        ],
      },
      {
        x: 9, y: 12, sprite: 'coach',
        pages: [
          'なぞなぞ門だ！ 3つの とびら。',
          '『1ばんめでも 3ばんめでもない\n  まんなかの とびらを えらべ』',
          'まちがえると もどされる。\nよく かんがえて すすもう！',
        ],
      },
    ],
    chests: [
      // 倉庫番パズル(上)のごほうび。
      { id: 'secret_chest_push', x: 6, y: 11, item: 'spike3', amount: 1, label: 'ゴールデンスパイク', requireFlag: 'secret_puzzle', lockedMsg: 'カギが かかっている。\nボールの パズルを とけば あきそうだ…' },
      // なぞなぞ門(下)をぬけた者へのごほうび。
      { id: 'secret_chest_quiz', x: 7, y: 15, item: 'uni3', amount: 1, label: 'おうごんユニフォーム' },
    ],
    objects: [],
    // 動く床（弾2）：左へ流れるベルト。
    conveyors: [
      { x: 9,  y: 6, dir: 'left' },
      { x: 10, y: 6, dir: 'left' },
      { x: 11, y: 6, dir: 'left' },
      { x: 12, y: 6, dir: 'left' },
    ],
    // 倉庫番パズル（弾2）：2個のボールを ▢ゴールへ。
    pushBlocks: [ { x: 2, y: 8 }, { x: 4, y: 8 } ],
    pushGoals:  [ { x: 2, y: 10 }, { x: 4, y: 10 } ],
    pushPuzzle: { solveFlag: 'secret_puzzle', clearMsg: 'カチッ！ たからばこの\nカギが はずれた おとが した！' },
    // ワープ（弾2）：帰り(13,2)＋なぞなぞ門のハズレ もどし(4,14)(10,14)。
    warps: [
      { x: 13, y: 2,  to: 'town1', tx: 13, ty: 9, msg: 'ワープで まちへ もどった！' },
      { x: 4,  y: 14, tx: 7, ty: 11, msg: 'ちがう とびらだ！\nもどされた…' },
      { x: 10, y: 14, tx: 7, ty: 11, msg: 'ちがう とびらだ！\nもどされた…' },
    ],
    exits: [],
    encounter: { rate: 0, enemies: [] },
  },

  // ══════════════════════════════════════════════════════════════════════
  //  legend_arena（追加弾3）：でんせつの アリーナ＝クリア後の 隠しダンジョン。
  //  クラウドタウン(town3)右の「でんせつの とびら」ワープから来る。
  //  ・道中は つよい てき＋レア(metal_keeper)が でる ガントレット。
  //  ・おくの ゴールド・エンペラー(専用ボス)を たおすと こうていのブーツ。
  //  ・撃破後(flags.boss_emperor)に 左下の宝箱が あき おうごんのよろい。
  //  帰りは右下(13,15)のワープで town3 へ。柱(#)で アリーナらしさを出す。
  // ══════════════════════════════════════════════════════════════════════
  legend_arena: {
    id: 'legend_arena',
    name: 'でんせつのアリーナ',
    grid: [
      '################', // r0
      '#FFFFFFFFFFFFFF#', // r1
      '#FFFFFFFFFFFFFF#', // r2
      '#FFF#FFFFFF#FFF#', // r3  ← 柱(4,3)(11,3)
      '#FFFFFFFFFFFFFF#', // r4  ← ゴールド・エンペラー(7,4)
      '#FFFFFFFFFFFFFF#', // r5
      '#FFF#FFFFFF#FFF#', // r6  ← 柱(4,6)(11,6)
      '#FFFFFFFFFFFFFF#', // r7
      '#FFFFFFFFFFFFFF#', // r8
      '#FFF#FFFFFF#FFF#', // r9  ← 柱(4,9)(11,9)
      '#FFFFFFFFFFFFFF#', // r10
      '#FFFFFFFFFFFFFF#', // r11
      '#FFF#FFFFFF#FFF#', // r12 ← 柱(4,12)(11,12)／案内(7,12)
      '#FFFFFFFFFFFFFF#', // r13
      '#FFFFFFFFFFFFFF#', // r14
      '#FFFFFFFFFFFFFF#', // r15 ← 到着(7,15)／宝箱(2,15)／帰りワープ(13,15)
      '#FFFFFFFFFFFFFF#', // r16
      '################', // r17
    ],
    npcs: [
      {
        x: 7, y: 4, sprite: 'kaiser',
        boss: {
          enemies: ['gold_emperor'],
          winFlag: 'boss_emperor', vanishFlag: 'boss_emperor',
          reward: { item: 'emperor_boots', amount: 1, label: 'こうていの ブーツ' },
        },
        pages: [
          'おうごんの オーラを まとう\nでんせつの エースが あらわれた！',
          'ゴールド・エンペラー\n「よくぞ きた、わかき エースよ。」',
          '「わが ぜんりょくを うけて みよ！」',
        ],
        afterPages: ['ゴールド・エンペラーは\nさわやかに わらって きえた。'],
      },
      {
        x: 7, y: 12, sprite: 'coach',
        pages: [
          'ここは でんせつの アリーナ。',
          'さいきょうの エースだけが\nたどりつける ばしょだ。',
          'おくに いる ゴールド・エンペラーは\nとてつもなく つよいぞ。\nじゅんびは いいか？',
        ],
      },
    ],
    chests: [
      // 専用ボス撃破後に ひらく ごほうび宝箱（追加弾3）。
      {
        id: 'legend_chest1', x: 2, y: 15, item: 'emperor_armor', amount: 1, label: 'おうごんの よろい',
        requireFlag: 'boss_emperor',
        lockedMsg: 'がっちり しまっている。\nエンペラーを たおせば あきそうだ…',
      },
    ],
    objects: [
      { x: 2,  y: 2,  type: 'goal',   solid: true },
      { x: 13, y: 2,  type: 'goal',   solid: true },
      { x: 6,  y: 4,  type: 'flower' },
      { x: 9,  y: 4,  type: 'flower' },
      { x: 7,  y: 8,  type: 'ball'   },
    ],
    // 帰りワープ（追加弾3）：town3 の入口(13,8)の すぐ下(13,9)へ戻す＝連鎖しない。
    warps: [
      { x: 13, y: 15, to: 'town3', tx: 13, ty: 9, msg: 'ひかりの とびらで\nクラウドタウンへ もどった！' },
    ],
    exits: [],
    encounter: { rate: 0.06, enemies: ['redcard_devil', 'trick_fox', 'stamina_zombie', 'pk_punisher'], rare: { rate: 0.06, enemies: ['metal_keeper'] } },
  },

  // ══════════════════════════════════════════════════════════════════════
  //  ちょうせんの間（追加弾4-D：ボスラッシュ）
  //  ・field6 の 南のとびら(7,16)から 入る（boss_kaiser 撃破後に解放）。
  //  ・おくの せんし(7,4)に はなしかけると、これまでの ボス4体と れんぞくバトル。
  //    とちゅうで HP・MPは かいふく しない（戦闘間で引き継ぐ）。
  //  ・はじめて 全クリアすると チャンピオンシューズ(最強の ぶき)。2回目以降は ごほうび無し。
  //  ・この部屋は ザコ戦なし(encounter.rate=0)。帰りは右下(13,15)のワープで field6 へ。
  // ══════════════════════════════════════════════════════════════════════
  challenge_room: {
    id: 'challenge_room',
    name: 'ちょうせんの間',
    grid: [
      '################', // r0
      '#FFFFFFFFFFFFFF#', // r1
      '#FFFFFFFFFFFFFF#', // r2
      '#FFF#FFFFFF#FFF#', // r3  ← 柱(4,3)(11,3)
      '#FFFFFFFFFFFFFF#', // r4  ← ボスラッシュ受付(7,4)
      '#FFFFFFFFFFFFFF#', // r5
      '#FFF#FFFFFF#FFF#', // r6  ← 柱(4,6)(11,6)
      '#FFFFFFFFFFFFFF#', // r7
      '#FFFFFFFFFFFFFF#', // r8
      '#FFF#FFFFFF#FFF#', // r9  ← 柱(4,9)(11,9)
      '#FFFFFFFFFFFFFF#', // r10
      '#FFFFFFFFFFFFFF#', // r11
      '#FFF#FFFFFF#FFF#', // r12 ← 柱(4,12)(11,12)／案内(7,12)
      '#FFFFFFFFFFFFFF#', // r13
      '#FFFFFFFFFFFFFF#', // r14
      '#FFFFFFFFFFFFFF#', // r15 ← 到着(7,15)／帰りワープ(13,15)
      '#FFFFFFFFFFFFFF#', // r16
      '################', // r17
    ],
    npcs: [
      {
        x: 7, y: 4, sprite: 'kaiser',
        bossRush: {
          enemies: ['guardian', 'phantom_striker', 'gold_emperor', 'dark_kaiser'],
          winFlag: 'challenge_clear',
          reward: { item: 'champion_spike', amount: 1, label: 'チャンピオンシューズ' },
        },
        pages: [
          'ここは ちょうせんの間。',
          'これまで たおした ボスたちが\nつぎつぎに おそいかかる！',
          'とちゅうで HP・MPは かいふく できない。\nぜんぶ たおせるか？',
          'ボスラッシュに ちょうせん する？',
        ],
        afterPages: [
          'きみは すべての ボスを たおした\nしんの チャンピオンだ！',
          'また ちょうせん するなら いつでも おいで！',
        ],
      },
      {
        x: 7, y: 12, sprite: 'coach',
        pages: [
          'ようこそ「ちょうせんの間」へ。',
          'おくの せんしに はなしかけると\nボスラッシュが はじまる。',
          'まけても だいじょうぶ。\nなんども ちょうせん できるよ。',
          'はじめる まえに そうび・どうぐを\nととのえて おくと いいぞ。',
        ],
      },
    ],
    objects: [
      { x: 2,  y: 2,  type: 'goal',   solid: true },
      { x: 13, y: 2,  type: 'goal',   solid: true },
      { x: 6,  y: 4,  type: 'flower' },
      { x: 9,  y: 4,  type: 'flower' },
      { x: 7,  y: 8,  type: 'ball'   },
    ],
    // 帰りワープ（追加弾4-D）：field6 の とびら(7,16)から 数タイル上(7,13)へ戻す＝即・再突入しない。
    warps: [
      { x: 13, y: 15, to: 'field6', tx: 7, ty: 13, msg: 'ひかりの とびらで\nもとの フィールドへ もどった！' },
    ],
    exits: [],
    encounter: { rate: 0, enemies: [] },
  },

  // ══════════════════════════════════════════════════════════════════════
  //  第2章「よみがえりし やみ」（追加弾5-A/E）
  //   town3 きたの とびら → ch2_gate → ch2_town → ch2_pass(中ボス)
  //     → ch2_castle(新ラスボス：ネオ・カイザー) → 第2章エンディング。
  //   接続規則：各マップ 到着(7,15)・南出口(7,16)=前マップ・北出口(7,1)=次マップ。
  // ══════════════════════════════════════════════════════════════════════

  // ── ch2_gate：やみの もん（第2章の入口・フィールド） ──────────────────
  ch2_gate: {
    id: 'ch2_gate',
    name: 'やみの もん',
    // 第2章 導入カットシーン：たおしたはずの やみが ふたたび――。
    cutscene: {
      flag: 'cs_ch2_gate',
      pages: [
        'ダーク・カイザーを たおし、\nまちには へいわが もどった――\nはずだった。',
        'だが きたの そらに、\nくろい うずが ひろがっていく。',
        'たおしたはずの やみが、\nふたたび よみがえったのだ。',
        'やみの もんの むこうから\nつめたい きはいが ながれてくる。',
        'ユイト「また みんなを\nおびえさせは しない。\nぼくが とめる！」',
      ],
    },
    grid: [
      '################', // r0
      '#......,.......#', // r1  ← 北出口(7,1)→ ch2_town
      '#......,.......#', // r2
      '#......,.......#', // r3
      '#......,.......#', // r4  ← 旅人(4,4)
      '#......,.......#', // r5
      '#......,.......#', // r6
      '#......,.......#', // r7
      '#......,.......#', // r8
      '#......,.......#', // r9
      '#......,.......#', // r10
      '#......,.......#', // r11 ← 宝箱(3,11)/(11,11)
      '#......,.......#', // r12
      '#......,.......#', // r13
      '#......,.......#', // r14
      '#......,.......#', // r15 ← 到着(7,15)
      '#......,.......#', // r16 ← 南出口(7,16)→ town3
      '################', // r17
    ],
    npcs: [
      {
        x: 4, y: 4, sprite: 'coach',
        pages: [
          'ここは やみの もん。\nこの さきは ノルドタウンだ。',
          'やみが もどってから\nまちの ひとは おびえている。',
          'きを つけて すすむんだ。\nきみなら きっと だいじょうぶ。',
        ],
      },
    ],
    chests: [
      { id: 'ch2_gate_chest1', x: 3,  y: 11, item: 'firstaid', amount: 2, label: 'きゅうきゅうセット' },
      { id: 'ch2_gate_chest2', x: 11, y: 11, item: 'firstaid', amount: 2, label: 'きゅうきゅうセット' },
    ],
    objects: [
      { x: 1,  y: 1,  type: 'tree',   solid: true },
      { x: 14, y: 1,  type: 'tree',   solid: true },
      { x: 2,  y: 4,  type: 'sign',   solid: true },
      { x: 13, y: 4,  type: 'tree',   solid: true },
      { x: 5,  y: 7,  type: 'ball'   },
      { x: 9,  y: 7,  type: 'flower' },
      { x: 2,  y: 13, type: 'tree',   solid: true },
      { x: 13, y: 13, type: 'tree',   solid: true },
    ],
    exits: [
      { x: 7, y: 16, to: 'town3',    tx: 7, ty: 2  },
      { x: 7, y: 1,  to: 'ch2_town', tx: 7, ty: 15 },
    ],
    encounter: {
      rate: 0.10,
      enemies: ['dark_soldier', 'night_raider', 'curse_wisp'],
      rare: { rate: 0.04, enemies: ['chaos_orb'] },
    },
  },

  // ── ch2_town：ノルドタウン（第2章の町・どうぐ屋/やどや/かじや） ─────────
  ch2_town: {
    id: 'ch2_town',
    name: 'ノルドタウン',
    isTown: true,
    cutscene: {
      flag: 'cs_ch2_town',
      pages: [
        'きたの まち、ノルドタウン。\nひとびとは やみの ふっかつに\nおびえている。',
        'ユイト「みんなを たすける。\nやみの もとを たたなくちゃ。」',
      ],
    },
    grid: [
      '################', // r0
      '#......,.......#', // r1  ← 北出口(7,1)→ ch2_pass
      '#......,.......#', // r2
      '#..FFF.,.FFF...#', // r3
      '#..FFF.,.FFF...#', // r4  ← どうぐ屋(3,4)／やどや(11,4)
      '#..FFF.,.FFF...#', // r5
      '#......,.......#', // r6
      '#......,.......#', // r7
      '#......,.......#', // r8  ← 物語NPC(4,8)／物語NPC(11,8)
      '#......,.......#', // r9
      '#......,.......#', // r10
      '#..FFF.,.FFF...#', // r11
      '#..FFF.,.FFF...#', // r12 ← かじや(3,12)／宝箱(11,12)
      '#..FFF.,.FFF...#', // r13
      '#......,.......#', // r14
      '#......,.......#', // r15 ← 到着(7,15)
      '#......,.......#', // r16 ← 南出口(7,16)→ ch2_gate
      '################', // r17
    ],
    npcs: [
      {
        x: 3, y: 4, sprite: 'shopkeep', shop: {
          type: 'item', name: 'どうぐ屋',
          greeting: 'やみが もどって きたんだ。\nしっかり そなえて いきな！',
          items: ['drink', 'jelly', 'firstaid', 'restart_whistle'],
        },
      },
      {
        x: 11, y: 4, sprite: 'shopkeep', shop: {
          type: 'inn', name: 'やどや', cost: 40,
          greeting: 'やみの よなかは こわいだろう。\nゆっくり やすんでいきな。',
        },
      },
      {
        x: 3, y: 12, sprite: 'shopkeep',
        forge: {
          name: 'かじや',
          greeting: 'てきが おとす そざいを もってきな。\nつよい そうびに きたえて やるぜ！',
        },
      },
      {
        x: 4, y: 8, sprite: 'coach',
        pages: [
          'やみの しろの おくに\nネオ・カイザーが いるらしい。',
          'ダーク・カイザーより\nもっと おそろしい やみの ぬしだ。',
          'きみたちだけが たよりなんだ。\nどうか やみを とめておくれ。',
        ],
      },
      {
        x: 11, y: 8, sprite: 'coach',
        pages: [
          'きたの こおりの とうげには\nやみの しょうぐん ヴォルクが いる。',
          'ヴォルクを たおさないと\nやみのしろへは すすめないよ。',
          'きを つけて いっておいで。',
        ],
      },
    ],
    chests: [
      { id: 'ch2_town_chest1', x: 11, y: 12, item: 'restart_whistle', amount: 1, label: 'さいかいの ホイッスル' },
    ],
    objects: [
      { x: 1,  y: 1,  type: 'goal',   solid: true },
      { x: 14, y: 1,  type: 'goal',   solid: true },
      { x: 2,  y: 4,  type: 'flower' },
      { x: 13, y: 4,  type: 'flower' },
      { x: 5,  y: 6,  type: 'ball'   },
      { x: 9,  y: 6,  type: 'ball'   },
      { x: 2,  y: 12, type: 'flower' },
      { x: 13, y: 12, type: 'flower' },
    ],
    exits: [
      { x: 7, y: 16, to: 'ch2_gate', tx: 7, ty: 2  },
      { x: 7, y: 1,  to: 'ch2_pass', tx: 7, ty: 15 },
    ],
    encounter: { rate: 0, enemies: [] },
  },

  // ── ch2_pass：こおりの とうげ（中ボス：やみの しょうぐん ヴォルク） ──────
  //   ヴォルク(7,4)を たおすと 北のとびらが ひらく。
  ch2_pass: {
    id: 'ch2_pass',
    name: 'こおりの とうげ',
    grid: [
      '################', // r0
      '#......,.......#', // r1  ← 北出口(7,1)→ ch2_castle（要 boss_dark_general）
      '#......,.......#', // r2
      '#......,.......#', // r3
      '#......,.......#', // r4  ← ヴォルク(7,4)
      '#......,.......#', // r5
      '#......,.......#', // r6  ← 案内(4,6)
      '#......,.......#', // r7
      '#......,.......#', // r8
      '#......,.......#', // r9
      '#......,.......#', // r10
      '#......,.......#', // r11 ← 宝箱(3,11)
      '#......,.......#', // r12
      '#......,.......#', // r13
      '#......,.......#', // r14
      '#......,.......#', // r15 ← 到着(7,15)
      '#......,.......#', // r16 ← 南出口(7,16)→ ch2_town
      '################', // r17
    ],
    npcs: [
      {
        x: 7, y: 4, sprite: 'kaiser',
        boss: {
          enemies: ['dark_general'],
          winFlag: 'boss_dark_general', vanishFlag: 'boss_dark_general',
          reward: { item: 'firstaid', amount: 3, label: 'きゅうきゅうセット' },
        },
        pages: [
          'やみの しょうぐん ヴォルクが\nゆくてを ふさいでいる！',
          '「やみのしろへは とおさん！」',
          '「ヴォルクの まえに ひざまずけ！」',
        ],
        afterPages: ['とうげの さきに\nくろい やみのしろが みえる。'],
      },
      {
        x: 4, y: 6, sprite: 'coach',
        pages: [
          'こおりの とうげは\nさむくて あぶないよ。',
          'おくの ヴォルクを たおせば\nやみのしろへ すすめるはずだ。',
        ],
      },
    ],
    chests: [
      { id: 'ch2_pass_chest1', x: 3, y: 11, item: 'restart_whistle', amount: 1, label: 'さいかいの ホイッスル' },
    ],
    objects: [
      { x: 1,  y: 1,  type: 'tree',   solid: true },
      { x: 14, y: 1,  type: 'tree',   solid: true },
      { x: 11, y: 4,  type: 'sign',   solid: true },
      { x: 2,  y: 8,  type: 'tree',   solid: true },
      { x: 13, y: 8,  type: 'tree',   solid: true },
      { x: 5,  y: 12, type: 'ball'   },
      { x: 10, y: 12, type: 'flower' },
    ],
    exits: [
      { x: 7, y: 16, to: 'ch2_town', tx: 7, ty: 2 },
      {
        x: 7, y: 1, to: 'ch2_castle', tx: 7, ty: 15,
        requireFlag: 'boss_dark_general',
        lockedMsg: 'やみの しょうぐん ヴォルクを\nたおさないと さきへは すすめない…',
      },
    ],
    encounter: {
      rate: 0.12,
      enemies: ['frost_keeper', 'shadow_beast', 'night_raider', 'curse_wisp'],
      rare: { rate: 0.05, enemies: ['chaos_orb'] },
    },
  },

  // ── ch2_castle：やみのしろ（新ラスボス：ネオ・カイザー） ────────────────
  ch2_castle: {
    id: 'ch2_castle',
    name: 'やみのしろ',
    cutscene: {
      flag: 'cs_ch2_castle',
      pages: [
        'やみのしろ。\nおもい くうきが たちこめる。',
        'おくの たまの ま に、\nくろい オーラを まとった\nネオ・カイザーが たっていた。',
        'よみがえった やみそのものの\nような すがた――。',
        'ユイト「ここで やみを たつ。\nみんな、いくぞ！」',
      ],
    },
    grid: [
      '################', // r0
      '#......,.......#', // r1
      '#......,.......#', // r2
      '#..F...,.......#', // r3  ← どうぐ屋(3,3)
      '#......,.......#', // r4
      '#......,.......#', // r5  ← ネオ・カイザー(7,5)
      '#......,.......#', // r6
      '#......,.......#', // r7
      '#......,.......#', // r8
      '#......,.......#', // r9
      '#......,.......#', // r10
      '#......,.......#', // r11 ← 宝箱(11,11)
      '#......,.......#', // r12
      '#......,.......#', // r13
      '#......,.......#', // r14
      '#......,.......#', // r15 ← 到着(7,15)
      '#......,.......#', // r16 ← 南出口(7,16)→ ch2_pass
      '################', // r17
    ],
    npcs: [
      {
        x: 3, y: 3, sprite: 'shopkeep', shop: {
          type: 'item', name: 'どうぐ屋',
          greeting: 'さいごの たたかいだ。\nじゅんびは いいか？',
          items: ['drink', 'jelly', 'firstaid', 'restart_whistle'],
        },
      },
      {
        x: 7, y: 5, sprite: 'kaiser',
        boss: { enemies: ['neo_kaiser'], winFlag: 'boss_neo_kaiser', vanishFlag: 'boss_neo_kaiser', ending: true },
        pages: [
          'ネオ・カイザーが\nしずかに たちあがった。',
          '「ダーク・カイザーは\nわが いちぶに すぎぬ。」',
          '「ほんものの やみの ちから、\nおもいしるが いい！」',
        ],
        afterPages: ['…もう たたかう あいては いない。\nやみは ほろびた。'],
      },
    ],
    chests: [
      { id: 'ch2_castle_chest1', x: 11, y: 11, item: 'restart_whistle', amount: 2, label: 'さいかいの ホイッスル' },
    ],
    objects: [
      { x: 1,  y: 1,  type: 'tree',   solid: true },
      { x: 14, y: 1,  type: 'tree',   solid: true },
      { x: 11, y: 3,  type: 'goal',   solid: true },
      { x: 2,  y: 8,  type: 'sign',   solid: true },
      { x: 13, y: 8,  type: 'sign',   solid: true },
      { x: 5,  y: 12, type: 'ball'   },
      { x: 10, y: 13, type: 'flower' },
    ],
    exits: [
      { x: 7, y: 16, to: 'ch2_pass', tx: 7, ty: 2 },
    ],
    encounter: {
      rate: 0.06,
      enemies: ['shadow_beast', 'curse_wisp'],
      rare: { rate: 0.04, enemies: ['chaos_orb'] },
    },
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
