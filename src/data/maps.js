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
  // 弾6：DQ風の地形タイル（field-scene.js が手描き＝procedural で描く）。
  //   森/川/岩は通行不可、橋/花畑は歩ける。下地は森/岩/花=草、川/橋=水。
  'T': { sprite: 't_tree',   walkable: false }, // 森の木（しげみ）
  'r': { sprite: 't_river',  walkable: false }, // 川（ながれる水）
  'b': { sprite: 't_bridge', walkable: true  }, // 木の橋（川をわたる）
  'R': { sprite: 't_rock',   walkable: false }, // 岩（おおきな石）
  'f': { sprite: 't_flower', walkable: true  }, // 花畑（とおれる）
  // Phase7-①「土台」：基本タイルも全部コード手描き化＋地形タイルを大量追加。
  //   field-scene.js の _drawBaseTile が下地ごとコードで描く（AI絵は卒業）。
  's': { sprite: 't_sand',      walkable: true  }, // 砂地・砂浜
  'w': { sprite: 't_snow',      walkable: true  }, // 雪原
  'W': { sprite: 't_deepwater', walkable: false }, // 深い水（濃い青・通れない）
  '=': { sprite: 't_cobble',    walkable: true  }, // 石だたみ（村の道）
  'P': { sprite: 't_wood',      walkable: true  }, // 木の床（家の中・桟橋）
  'c': { sprite: 't_cavefloor', walkable: true  }, // 洞窟の床
  'C': { sprite: 't_cavewall',  walkable: false }, // 洞窟の岩壁
  'L': { sprite: 't_lava',      walkable: false }, // 溶岩（ながれる・通れない）
  // Phase7-④「こおりの とう」：氷のダンジョン用タイル（field-scene.js がコードで描く）。
  'I': { sprite: 't_ice',     walkable: true  }, // 氷のゆか（つるつる光る・歩ける）
  'X': { sprite: 't_icewall', walkable: false }, // 氷のかべ（あつい氷・通れない）
  // Phase7-⑤「もりの しんでん」：森の神殿用タイル（field-scene.js がコードで描く）。
  'M': { sprite: 't_moss', walkable: true  }, // 苔のゆか（やわらかい緑・歩ける）
  'V': { sprite: 't_vine', walkable: false }, // つるのかべ（からみつく・通れない）
  // Phase7-⑥「みずの どうくつ」：地底湖の浅瀬タイル（field-scene.js の _drawShallowTile が描く）。
  'a': { sprite: 't_shallow', walkable: true }, // 浅瀬（水色のあさい水・じゃぶじゃぶ歩ける）
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
        '―― はじまりの草原。\nあさの ひかりが まぶしい。',
        'みなみへ つづく みちの さき、\nさいしょの まちが みえる。',
        'ユイト「いくぞ！ おうごんの\nボール、いま むかえに いく！」',
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
          'この くさはらの どこかに\nはやての FW イクマが いるらしい。\nさがして なかまに しよう！',
        ],
        variants: [
          { requireFlag: 'joined_ikuma', pages: [
            'イクマを なかまに したんだね！\nあの スピードは こころづよいよ。',
          ] },
        ],
      },
      {
        x: 9, y: 9, sprite: 'ikuma', joinId: 'ikuma', vanishFlag: 'joined_ikuma',
        joinStory: [
          'イクマ「おれは この まちいちばんの\nストライカーだった。」',
          'イクマ「でも カイザーに ボールを\nうばわれて、なにも できなかった。\nくやしくて くやしくて…。」',
          'イクマ「でも ユイト、きみと なら\nもういちど はしれる きが する！\nおれを つれてってくれ！」',
        ],
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
      { x: 7, y: 16, to: 'town1', tx: 7, ty: 2,
        requireFlag: 'joined_ikuma',
        lockedMsg: 'まちへ いくまえに…\nくさはらの どこかで\nはやての FW イクマが\nまっているみたいだ。\nさがして はなしかけよう！' },
    ],
    encounter: { rate: 0.045, enemies: ['foul_goblin', 'offside_ghost', 'mud_slime'], rare: { rate: 0.05, enemies: ['golden_ball'] } },
  },

  // ── field2：ナイタースタジアム（アオシ加入・装備屋） ──────────────────
  field2: {
    id: 'field2',
    name: 'ナイタースタジアム',
    ambient: 'night',   // 夜：星のまたたき＋ほたるのひかり
    // 弾6：森(T)・川(r)・橋(b)・岩(R)・花畑(f)で DQ 風に。
    //   川が横にながれ、まんなかの橋(7,5)でしか わたれない＝自然な関所ギミック。
    //   col7 は到着(7,2)→橋→出口(7,16)まで歩ける道。NPC/宝箱/動く床の座標は踏めるまま。
    grid: [
      '################', // r0
      '#TT....,.....TT#', // r1  ← ゴール装飾(3,1)(11,1)・四すみは森
      '#TT....,.....TT#', // r2  ← 到着(7,2)
      '#T.....,......T#', // r3
      '#..R...,....R..#', // r4  ← 岩(3,4)(12,4)
      '#rrrrrrbrrrrrrr#', // r5  ← 川＋橋(7,5)だけ わたれる
      '#......,.......#', // r6  ← ボール(5,6)(9,6)
      '#......,.......#', // r7
      '#......,.......#', // r8  ← アオシ(4,8)／装備屋(11,8)
      '#.ff...,.......#', // r9  ← 花畑
      '#.f....,.......#', // r10
      '#......,.......#', // r11 ← コーチ(9,11)／宝箱(12,11)
      '#......,.......#', // r12 ← 動く床(7,12)
      '#......,.......#', // r13 ← 動く床(7,13)
      '#.ff...,....ff.#', // r14 ← 動く床(7,14)・花畑
      '#......,.......#', // r15
      '#......,.......#', // r16 ← 出口(7,16)
      '################', // r17
    ],
    npcs: [
      {
        x: 4, y: 8, sprite: 'aoshi', joinId: 'aoshi', vanishFlag: 'joined_aoshi',
        joinStory: [
          'アオシ「ぼくは しあいの ながれを\nよむのが とくいな しれいとうさ。」',
          'アオシ「でも ひとりの ちからでは\nカイザーには かてない。\nそう しった よるが あった。」',
          'アオシ「きみの チームで\nパスを つなぎたい。\nいっしょに いかせてくれ。」',
        ],
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
          'すなはまの サンドコートに\nまもりの たつじんが いるらしいぞ。',
        ],
        variants: [
          { requireFlag: 'joined_tomoki', pages: [
            'トモキを なかまに したのか！\nあれで まもりは ばんぜんだな。',
          ] },
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
      { x: 7, y: 1, to: 'town1', tx: 7, ty: 15, msg: 'ハーバータウンへ もどる…' },
      { x: 7, y: 16, to: 'field3', tx: 7, ty: 2,
        requireFlag: 'joined_aoshi',
        lockedMsg: 'スタジアムの どこかに\nてんさい MF アオシが いる。\nなかまに さそってから\nさきへ すすもう！' },
    ],
    encounter: { rate: 0.05, enemies: ['foul_goblin', 'offside_ghost', 'mud_slime', 'corner_crow'], rare: { rate: 0.05, enemies: ['golden_ball'] } },
  },

  // ── field3：サンドコート（トモキ加入） ──────────────────────────────
  field3: {
    id: 'field3',
    name: 'サンドコート',
    ambient: 'sand',   // 砂：砂ぼこりがよこに流れる
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
        joinStory: [
          'トモキ「ぼくは この まちを\nまもれなかった…。\nずっと じぶんを せめてきた。」',
          'トモキ「もう にどと\nなかまを なかせたくない。」',
          'トモキ「だから ぼくが かべに なる！\nユイト、うしろは しんぱいするな！」',
        ],
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
      { x: 7, y: 1, to: 'field2', tx: 7, ty: 15, msg: 'ナイタースタジアムへ もどる…' },
      { x: 7, y: 16, to: 'town2', tx: 7, ty: 2,
        requireFlag: 'joined_tomoki',
        lockedMsg: 'すなはまの どこかで\nまもりの DF トモキが\nきみを まっている。\nはなしかけて なかまに しよう！' },
    ],
    encounter: { rate: 0.055, enemies: ['offside_ghost', 'hand_monster', 'corner_crow', 'throwin_golem'], rare: { rate: 0.05, enemies: ['golden_ball'] } },
  },

  // ── field4：レイニーピッチ（イツキ加入＝5人・道具屋） ─────────────────
  field4: {
    id: 'field4',
    name: 'レイニーピッチ',
    ambient: 'rain',   // 雨：あめが降る＋雲かげ
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
        joinStory: [
          'イツキ「ぼくは でんせつの キーパーに\nあこがれて れんしゅうしてきた。」',
          'イツキ「ゴールを まもるのは、\nみんなの ゆめを まもること。\nそう おしえてもらったんだ。」',
          'イツキ「うしろは まかせろ！\nきみたちの ゴールは\nぜったいに わらせない。」',
        ],
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
      { x: 7, y: 1, to: 'town2', tx: 7, ty: 15, msg: 'フォレストタウンへ もどる…' },
      { x: 7, y: 16, to: 'field5', tx: 7, ty: 2,
        requireFlag: 'joined_itsuki',
        lockedMsg: 'あめの ピッチの どこかに\nでんせつの GK イツキが いる。\n5にんめの なかまを\nむかえに いこう！' },
    ],
    encounter: { rate: 0.06, enemies: ['hand_monster', 'yellowcard_bat', 'throwin_golem', 'losstime_ghost'], rare: { rate: 0.05, enemies: ['metal_keeper'] } },
  },

  // ── field5：スカイスタジアム（中ボス：ゴーレムキーパー） ──────────────
  //   r9 が壁の帯（col7 だけ開く）。キーパーが その隙間(7,9)を塞ぐ。
  //   倒すと vanishFlag で消え、下半分へ抜けられる。
  field5: {
    id: 'field5',
    name: 'スカイスタジアム',
    ambient: 'sky',   // 空：雲が流れる＋きらめき
    cutscenes: [
      { flag: 'cs_win_guardian', requireFlag: 'boss_guardian', pages: [
        'ガーディアンは ひかりに つつまれ\nしずかに きえていった。',
        'トモキ「まもりを かためれば\nどんな てきも こわくない。」',
        'イツキ「うしろは まかせろ。\nつぎは いよいよ ダークアリーナだ！」',
      ] },
    ],
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
      { x: 7, y: 1, to: 'field4', tx: 7, ty: 15, msg: 'レイニーピッチへ もどる…' },
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
    ambient: 'embers',   // 火の粉：オレンジの粒が昇る
    // 決戦まえ・カットシーン（弾4）：ダークアリーナ入場で一度だけ流れる。
    //   仲間の演出は序盤で必ず加入する イクマ・アオシ に限定（未加入でも矛盾しない）。
    cutscenes: [
      { flag: 'cs_field6', pages: [
        'くらい アリーナ。\nくうきが ずしりと おもい。\nここに カイザーが いる――。',
        'ながい たびだった。\nたくさんの てきと たたかい、\nここまで きた。',
        'ユイト「みんな、\nここまで ついてきて くれて\nありがとう。」',
        'イクマ「なに いってんだ、\nさいごまで いっしょだろ！」',
        'アオシ「おちつけ、ユイト。\nぼくらの サッカーを\nしんじれば いい。」',
        'ユイトは まえを みすえた。\nユイト「いくぞ――けっせんだ！」',
      ] },
      { flag: 'cs_after_ch1', requireFlag: 'boss_kaiser', pages: [
        'トロフィーを かかげた 5にん。\nかんせいが スタジアムに ひびく。',
        'だが とおくの そらに、\nくろい かげが うずまいていた。',
        'アオシ「あれは…\nまだ おわって いないのか？」',
        'ユイト「いこう。\nだい2しょうの はじまりだ！」',
      ] },
    ],
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
        requireFlag: 'challenge_clear',
        lockedMsg: 'ダーク・カイザー「まだ たたかう\nときでは ない…\nちょうせんの間で うでだめしを\nクリアしてから いどんで こい。」',
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
      { x: 7, y: 1, to: 'town3', tx: 7, ty: 15, msg: 'クラウドタウンへ もどる…' },
      { x: 7, y: 16, to: 'challenge_room', tx: 7, ty: 15 },
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
        x: 6, y: 2, sprite: 'coach', guide: true,
        pages: ['こまったら いつでも\nコーチに きいてね！'],
      },
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
          'にしの はずれの みちを ゆくと\n「みのりの村」が あるんだって。',
        ],
        variants: [
          { requireFlag: 'boss_magma', pages: [
            'マグマ・ゴーレムを たおしたって!?\nきみたちは まちの えいゆうだ！',
            'ナイタースタジアムに\nてんさい MF アオシが いるって\nうわさだよ。さがしてみな！',
          ] },
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
      { x: 7, y: 1, to: 'field1', tx: 7, ty: 15, msg: 'はじまりの草原へ もどる…' },
      { x: 7, y: 16, to: 'field2', tx: 7, ty: 2,
        requireFlag: 'boss_magma',
        lockedMsg: 'スタジアムへの みちは\nまだ とおれない。\nまずは みのりの村の おくの\nほのおの どうくつで\nマグマ・ゴーレムを たおそう！' },
      { x: 1, y: 2, to: 'village1', tx: 10, ty: 1,
        requireFlag: 'secret_puzzle',
        lockedMsg: 'にしの むらへの みちが\nひかって とじている。\nかくしべやの ボールパズルを\nとくと ひらきそうだ…' },
    ],
    encounter: { rate: 0, enemies: [] },
  },

  // ── village1：みのりの村（town1 の西にある のどかな農村・お店と宿屋あり） ──
  village1: {
    id: 'village1',
    name: 'みのりの村',
    ambient: 'leaves',   // 落ち葉：木の葉がひらひら舞う のどかな村
    isTown: true,
    grid: [
      '####################', // r0
      '#.T......==......T.#', // r1  ← 到着(10,1)
      '#.#####.f==.f#####.#', // r2  看板(9,2)
      '#.#PPP#..==..#PPP#.#', // r3  家A(道具屋)左／家C(村人)右
      '#.#PPP#======#PPP#.#', // r4
      '#.##=##..==..##=##.#', // r5  家Aドア(4,5)／家Cドア(15,5)
      '#........==........#', // r6  子供(10,6)
      '#......fT==...f.T..#', // r7
      '#........==........#', // r8
      '#......======......#', // r9  ベンチ(12,9)
      '#.================.#', // r10 井戸(10,10)・村人(6,10)・宝箱(16,10)
      '#.================.#', // r11
      '#......======......#', // r12
      '#.#####f.==..Tf....#', // r13 家B(宿屋)
      '#.#PPP#..==........#', // r14
      '#.#PPP#..==........#', // r15
      '#.##=##==========..#', // r16 家Bドア(4,16)・宿屋NPC(4,16)
      '#..,,,,,.==..ffff..#', // r17 畑(左)／花畑(右)
      '#..,,,,,T==..ffff..#', // r18
      '#..,,,,,.==..ffff..#', // r19
      '#.T......==......T.#', // r20 出口(10,20)
      '####################', // r21
    ],
    npcs: [
      {
        x: 4, y: 5, sprite: 'shopkeep', shop: {
          type: 'item', name: 'よろずや',
          greeting: 'みのりの村へ ようこそ！\nおてごろな しなものが あるよ。',
          items: ['drink', 'jelly', 'firstaid'],
        },
      },
      {
        x: 4, y: 16, sprite: 'shopkeep', shop: {
          type: 'inn', name: 'むらの やどや', cost: 15,
          greeting: 'のんびり やすんで いってね。',
        },
      },
      {
        x: 15, y: 5, sprite: 'coach',
        pages: [
          'この村は おいしい やさいと\nおはなで ゆうめいなんだ。',
          'まんなかの いどの みずは\nとっても つめたくて うまいぞ！',
        ],
      },
      {
        x: 10, y: 6, sprite: 'coach',
        pages: [
          'おにいちゃん つよそう！',
          'はたけで とれた やさいを\nたべると げんきが でるんだって！',
        ],
      },
      {
        x: 6, y: 10, sprite: 'shopkeep',
        pages: [
          'にしの みちは まだ あぶないよ。',
          'やどやで やすんでから\nぼうけんに でかけると いいよ。',
        ],
        variants: [
          {
            requireFlag: 'boss_magma',
            pages: [
              'どうくつの ゴーレムを たおして\nくれて ありがとう！',
              'むらは たすかったよ。\nきみたちは ほんとうの えいゆうだ！',
            ],
          },
        ],
      },
    ],
    chests: [
      { x: 16, y: 10, id: 'chest_village1', flag: 'chest_village1', item: 'firstaid', amount: 1, label: 'きゅうきゅうセット' },
    ],
    objects: [
      { x: 10, y: 10, type: 'well',  solid: true },
      { x: 12, y: 9,  type: 'bench', solid: true },
      { x: 9,  y: 2,  type: 'sign',  solid: true },
      { x: 2,  y: 17, type: 'fence', solid: true },
      { x: 2,  y: 18, type: 'fence', solid: true },
      { x: 2,  y: 19, type: 'fence', solid: true },
      { x: 3,  y: 17, type: 'crop' },
      { x: 5,  y: 17, type: 'crop' },
      { x: 7,  y: 17, type: 'crop' },
      { x: 4,  y: 18, type: 'crop' },
      { x: 6,  y: 18, type: 'crop' },
      { x: 3,  y: 19, type: 'crop' },
      { x: 5,  y: 19, type: 'crop' },
      { x: 7,  y: 19, type: 'crop' },
      { x: 13, y: 17, type: 'flower' },
      { x: 15, y: 17, type: 'flower' },
      { x: 14, y: 19, type: 'flower' },
    ],
    exits: [
      { x: 10, y: 20, to: 'town1', tx: 2, ty: 2 },
      { x: 18, y: 10, to: 'cave1', tx: 8, ty: 16 },   // 村の東はずれ → ほのおの どうくつ
    ],
    encounter: { rate: 0, enemies: [] },
  },

  // ── cave1：ほのおの どうくつ（みのりの村の東・溶岩のどうくつ・たいまつ暗闇） ──
  //   Phase7-③ ダンジョン。洞窟タイル c/C・ようがん L・橋 b の ひろい探索マップ
  //   (20行×18列・スクロール)。dark:true で たいまつ視界。おくの ボス magma_golem を
  //   たおすと ボス部屋の宝箱(ミスリルアーマー)が ひらく。かくし通路 H の先に ひみつ宝。
  cave1: {
    id: 'cave1',
    name: 'ほのおの どうくつ',
    dark: true,
    cutscenes: [
      { flag: 'cs_win_magma', requireFlag: 'boss_magma', pages: [
        'マグマ・ゴーレムは くずれおちた。\nどうくつに しずけさが もどる。',
        'イクマ「やったな ユイト！\nおれたちの スピードは\nマグマにも まけなかったぜ！」',
        'ユイト「つぎは スカイスタジアムだ。\nいこう、みんな！」',
      ] },
    ],
    grid: [
      'CCCCCCCCCCCCCCCCCC', // y0
      'CCCccccccccccccCCC', // y1  ボス部屋・おく宝箱(4,1)
      'CCCccccccccccccCCC', // y2
      'CCCccccccccccccCCC', // y3  ボス magma_golem(9,3)
      'CCCCCCCCCcCCCCCCCC', // y4  くびれ(col9)
      'CCCCCCCCCcCCCCCCCC', // y5
      'CCCccccccccccccCCC', // y6  大広間
      'CcHccccccccccccCCC', // y7  かくし通路 H(2,7)→ひみつ宝(1,7)
      'CCCCCCCCccCCCCCCCC', // y8  開口(col8-9)
      'CccccccccccccccccC', // y9  溶岩洞 うえゆか
      'CLLLLLLLbbLLLLLLLC', // y10 ようがん＋橋(col8-9)
      'CLLLLLLLbbLLLLLLLC', // y11
      'CccccccccccccccccC', // y12 溶岩洞 したゆか
      'CCCCCCCCccCCCCCCCC', // y13 開口(col8-9)
      'CCCCCcccccccCCCCCC', // y14 入口部屋
      'CCCCCcccccccCCCCCC', // y15 道中宝(5,15)
      'CCCCCcccccccCCCCCC', // y16 むらからの到着(8,16)
      'CCCCCcccccccCCCCCC', // y17 むらへもどる(8,17)
      'CCCCCCCCCCCCCCCCCC', // y18
      'CCCCCCCCCCCCCCCCCC', // y19
    ],
    npcs: [
      {
        x: 9, y: 3, sprite: 'kaiser',
        boss: {
          enemies: ['magma_golem'],
          winFlag: 'boss_magma', vanishFlag: 'boss_magma',
          reward: { item: 'spike2', amount: 1, label: 'スピードスパイク' },
        },
        pages: [
          'いわの おくが あかく もえている…',
          'マグマ・ゴーレム\n「ようがんの ねむりを\nさました やつは だれだ！」',
          '「もえつきて しまえ！」',
        ],
        afterPages: ['マグマ・ゴーレムは くずれおち\nしずかな いわに もどった。'],
      },
    ],
    chests: [
      { id: 'cave1_chest1', x: 5, y: 15, item: 'firstaid', amount: 2, label: 'きゅうきゅうセット' },
      { id: 'cave1_chest_hidden', x: 1, y: 7, item: 'mat_gold', amount: 2, label: 'こがねの かけら' },
      {
        id: 'cave1_chest_boss', x: 4, y: 1, item: 'forged_guard', amount: 1, label: 'こうてつガード',
        requireFlag: 'boss_magma',
        lockedMsg: 'あつい いわで ふさがれている。\nゴーレムを たおせば あきそうだ…',
      },
    ],
    objects: [
      { x: 8,  y: 5,  type: 'torch', solid: true },
      { x: 10, y: 5,  type: 'torch', solid: true },
      { x: 7,  y: 13, type: 'torch', solid: true },
      { x: 10, y: 13, type: 'torch', solid: true },
    ],
    exits: [
      { x: 8, y: 17, to: 'village1', tx: 18, ty: 10 },
    ],
    encounter: {
      rate: 0.08,
      enemies: ['foul_goblin', 'mud_slime', 'offside_ghost', 'corner_crow'],
      rare: { rate: 0.04, enemies: ['golden_ball'] },
    },
  },

  // ── Phase7-④「こおりの とう」3フロアの 氷ダンジョン（ch2_town 東口から） ──
  //   各フロア 18行×16列（標準サイズ）。階段は exits で接続し、到着マスと
  //   帰還マスを別にしてループ防止。隠し宝は左下ポケットで H 経由のみ到達可。
  //   I=氷ゆか(walk) X=氷かべ(solid) H=隠し通路。ambient:'snow' で雪が舞う。
  tower_ice_1f: {
    id: 'tower_ice_1f',
    name: 'こおりの とう 1かい',
    ambient: 'snow',
    grid: [
      'XXXXXXXXXXXXXXXX', // r0
      'XIIIIIIIIIIIIIIX', // r1  上り階段(8,1)→2F
      'XIIIIIIIIIIIIIIX', // r2  (8,2)=2Fから降りた到着
      'XIIXXIIIIIIXXIIX', // r3
      'XIIXIIIIIIIIXIIX', // r4
      'XIIIIIIIIIIIIIIX', // r5
      'XIIIIIXXXXIIIIIX', // r6
      'XIIIIIIIIIIIIIIX', // r7
      'XIIXXIIIIIIXXIIX', // r8
      'XIIXIIIIIIIIXIIX', // r9
      'XIIIIIIIIIIIIIIX', // r10
      'XIIIIIIIIIIIIIIX', // r11
      'XIIIIIIIIIIIIIIX', // r12
      'XIIIIIIIIIIIIIIX', // r13
      'XHXIIIIIIIIIIIIX', // r14  かくし通路 H(1,14)→隠し宝
      'XIXIIIIIIIIIIIIX', // r15  隠し宝(1,15)／道中宝(14,15)
      'XXIIIIIIIIIIIIIX', // r16  町からの到着(8,15)／帰還(8,16)→町
      'XXXXXXXXXXXXXXXX', // r17
    ],
    npcs: [],
    chests: [
      { id: 'tower1f_chest1', x: 14, y: 15, item: 'firstaid', amount: 2, label: 'きゅうきゅうセット' },
      { id: 'tower1f_chest_hidden', x: 1, y: 15, item: 'mat_gold', amount: 2, label: 'こがねの かけら' },
    ],
    exits: [
      { x: 8, y: 1,  to: 'tower_ice_2f', tx: 8, ty: 15 },
      { x: 8, y: 16, to: 'ch2_town',     tx: 14, ty: 9 },
    ],
    encounter: {
      rate: 0.10,
      enemies: ['snow_yeti', 'blizzard_bat', 'frost_wisp'],
      rare: { rate: 0.05, enemies: ['silver_fox'] },
    },
  },

  tower_ice_2f: {
    id: 'tower_ice_2f',
    name: 'こおりの とう 2かい',
    ambient: 'snow',
    grid: [
      'XXXXXXXXXXXXXXXX', // r0
      'XIIIIIIIIIIIIIIX', // r1  上り階段(8,1)→3F
      'XIIIIIIIIIIIIIIX', // r2  (8,2)=3Fから降りた到着
      'XXXXXXIIIIXXXXXX', // r3
      'XIIIIIIIIIIIIIIX', // r4
      'XIIXXXIIIIXXXIIX', // r5
      'XIIXIIIIIIIIXIIX', // r6
      'XIIXIIIIIIIIXIIX', // r7
      'XIIXIIIIIIIIXIIX', // r8  中央宝(8,8)
      'XIIXXXIIIIXXXIIX', // r9
      'XIIIIIIIIIIIIIIX', // r10
      'XIIIIIIIIIIIIIIX', // r11
      'XIIIIIIIIIIIIIIX', // r12
      'XIIIIIIIIIIIIIIX', // r13
      'XHXIIIIIIIIIIIIX', // r14  かくし通路 H(1,14)
      'XIXIIIIIIIIIIIIX', // r15  隠し宝(1,15)／(8,15)=1Fからの到着
      'XXIIIIIIIIIIIIIX', // r16  帰還(8,16)→1F
      'XXXXXXXXXXXXXXXX', // r17
    ],
    npcs: [],
    chests: [
      { id: 'tower2f_chest1', x: 8, y: 8, item: 'restart_whistle', amount: 1, label: 'リスタートの笛' },
      { id: 'tower2f_chest_hidden', x: 1, y: 15, item: 'mat_crystal', amount: 2, label: 'ちからの クリスタル' },
    ],
    exits: [
      { x: 8, y: 1,  to: 'tower_ice_3f', tx: 8, ty: 15 },
      { x: 8, y: 16, to: 'tower_ice_1f', tx: 8, ty: 2 },
    ],
    encounter: {
      rate: 0.10,
      enemies: ['snow_yeti', 'blizzard_bat', 'frost_wisp'],
      rare: { rate: 0.05, enemies: ['silver_fox'] },
    },
  },

  tower_ice_3f: {
    id: 'tower_ice_3f',
    name: 'こおりの とう さいじょうかい',
    ambient: 'snow',
    cutscenes: [
      { flag: 'cs_win_ice', requireFlag: 'boss_ice', pages: [
        'アイス・ゴーレムは くだけちり、\nこおりの とうに ひかりが さした。',
        'アオシ「おちついて よめば、\nかたい こおりにも すきが ある。」',
        'ユイト「つぎは もりの しんでんだ。\nもうすこしで やみに とどく！」',
      ] },
    ],
    grid: [
      'XXXXXXXXXXXXXXXX', // r0
      'XIIIIIIIIIIIIIIX', // r1  ロック宝(6,1)＝ボス撃破で解除
      'XIIIIIIIIIIIIIIX', // r2
      'XIIIIIIIIIIIIIIX', // r3  ボスNPC(8,3)
      'XIIIIIIIIIIIIIIX', // r4
      'XIIIXXXIIXXXIIIX', // r5
      'XIIIIIIIIIIIIIIX', // r6
      'XIIIIIIIIIIIIIIX', // r7
      'XXIIIIIIIIIIIIXX', // r8
      'XIIIIIIIIIIIIIIX', // r9
      'XIIIIIIIIIIIIIIX', // r10
      'XIIIXXXIIXXXIIIX', // r11
      'XIIIIIIIIIIIIIIX', // r12
      'XIIIIIIIIIIIIIIX', // r13
      'XHXIIIIIIIIIIIIX', // r14  かくし通路 H(1,14)
      'XIXIIIIIIIIIIIIX', // r15  隠し宝(1,15)／(8,15)=2Fからの到着
      'XXIIIIIIIIIIIIIX', // r16  帰還(8,16)→2F
      'XXXXXXXXXXXXXXXX', // r17
    ],
    npcs: [
      {
        x: 8, y: 3, sprite: 'kaiser',
        boss: {
          enemies: ['ice_golem'],
          winFlag: 'boss_ice', vanishFlag: 'boss_ice',
          reward: { item: 'frost_spike', amount: 1, label: 'フロストスパイク' },
        },
        pages: [
          'こおりの かがやきが\nゆくてを てらしている…',
          'アイス・ゴーレム\n「こおりの とうに\nたちいる ものは だれだ！」',
          '「こおりづけに してやる！」',
        ],
        afterPages: ['アイス・ゴーレムは くずれおち\nしずかな こおりに もどった。'],
      },
    ],
    chests: [
      {
        id: 'tower3f_chest_boss', x: 6, y: 1, item: 'frost_mail', amount: 1, label: 'フロストメイル',
        requireFlag: 'boss_ice',
        lockedMsg: 'こおりで かたく とざされている。\nゴーレムを たおせば とけそうだ…',
      },
      { id: 'tower3f_chest_hidden', x: 1, y: 15, item: 'mat_star', amount: 1, label: 'でんせつの ほし' },
    ],
    exits: [
      { x: 8, y: 16, to: 'tower_ice_2f', tx: 8, ty: 2 },
    ],
    encounter: {
      rate: 0.10,
      enemies: ['snow_yeti', 'blizzard_bat', 'frost_wisp'],
      rare: { rate: 0.05, enemies: ['silver_fox'] },
    },
  },

  // ── Phase7-⑤「もりの しんでん」：氷の塔とラスボス城のあいだの本線ダンジョン（3層）──
  //   ambient:'forest' ＝ こもれびの緑の光の粒。新タイル M=苔床(歩ける)／V=つる壁(通れない)。
  //   構造はこおりの とう（実証済み）の文字置換：X→V壁・I→M苔床・内部X→T木。踏破性そのまま。
  shrine_forest_1f: {
    id: 'shrine_forest_1f',
    name: 'もりの しんでん 1かい',
    ambient: 'forest',
    grid: [
      'VVVVVVVVVVVVVVVV', // r0
      'VMMMMMMMMMMMMMMV', // r1  上り階段(8,1)→2F
      'VMMMMMMMMMMMMMMV', // r2  (8,2)=2Fから降りた到着
      'VMMTTMMMMMMTTMMV', // r3
      'VMMTMMMMMMMMTMMV', // r4
      'VMMMMMMMMMMMMMMV', // r5  ガイドNPC コーチ(3,5)
      'VMMMMMTTTTMMMMMV', // r6
      'VMMMMMMMMMMMMMMV', // r7
      'VMMTTMMMMMMTTMMV', // r8
      'VMMTMMMMMMMMTMMV', // r9
      'VMMMMMMMMMMMMMMV', // r10
      'VMMMMMMMMMMMMMMV', // r11
      'VMMMMMMMMMMMMMMV', // r12
      'VMMMMMMMMMMMMMMV', // r13
      'VHVMMMMMMMMMMMMV', // r14  かくし通路 H(1,14)→隠し宝
      'VMVMMMMMMMMMMMMV', // r15  隠し宝(1,15)／道中宝(14,15)／(8,15)=ch2_passからの到着
      'VVMMMMMMMMMMMMMV', // r16  帰還(8,16)→ch2_pass
      'VVVVVVVVVVVVVVVV', // r17
    ],
    npcs: [
      {
        x: 3, y: 5, sprite: 'coach',
        pages: [
          'コーチ\n「ここは もりの しんでんだ。\nさいじょうかいに 森の守り神が\nいるらしいぞ。」',
          '「うえへ うえへと のぼって\nしんでんの ぬしを たおせば\nやみのしろへの みちが ひらく。」',
          '「みどりの ひかりに きをつけて\nがんばって のぼるんだ！」',
        ],
      },
    ],
    chests: [
      { id: 'shrine1f_chest1', x: 14, y: 15, item: 'firstaid', amount: 2, label: 'きゅうきゅうセット' },
      { id: 'shrine1f_chest_hidden', x: 1, y: 15, item: 'mat_gold', amount: 2, label: 'こがねの かけら' },
    ],
    exits: [
      { x: 8, y: 1,  to: 'shrine_forest_2f', tx: 8, ty: 15 },
      { x: 8, y: 16, to: 'ch2_pass',         tx: 7, ty: 2 },
    ],
    encounter: {
      rate: 0.10,
      enemies: ['moss_golem', 'forest_crow', 'thorn_goblin'],
      rare: { rate: 0.05, enemies: ['emerald_deer'] },
    },
  },

  shrine_forest_2f: {
    id: 'shrine_forest_2f',
    name: 'もりの しんでん 2かい',
    ambient: 'forest',
    grid: [
      'VVVVVVVVVVVVVVVV', // r0
      'VMMMMMMMMMMMMMMV', // r1  上り階段(8,1)→3F
      'VMMMMMMMMMMMMMMV', // r2  (8,2)=3Fから降りた到着
      'VVVVVVMMMMVVVVVV', // r3
      'VMMMMMMMMMMMMMMV', // r4
      'VMMVVVMMMMVVVMMV', // r5
      'VMMVMMMMMMMMVMMV', // r6
      'VMMVMMMMMMMMVMMV', // r7
      'VMMVMMMMMMMMVMMV', // r8  中央宝(8,8)
      'VMMVVVMMMMVVVMMV', // r9
      'VMMMMMMMMMMMMMMV', // r10
      'VMMMMMMMMMMMMMMV', // r11
      'VMMMMMMMMMMMMMMV', // r12
      'VMMMMMMMMMMMMMMV', // r13
      'VHVMMMMMMMMMMMMV', // r14  かくし通路 H(1,14)
      'VMVMMMMMMMMMMMMV', // r15  隠し宝(1,15)／(8,15)=1Fからの到着
      'VVMMMMMMMMMMMMMV', // r16  帰還(8,16)→1F
      'VVVVVVVVVVVVVVVV', // r17
    ],
    npcs: [],
    chests: [
      { id: 'shrine2f_chest1', x: 8, y: 8, item: 'restart_whistle', amount: 1, label: 'リスタートの笛' },
      { id: 'shrine2f_chest_hidden', x: 1, y: 15, item: 'mat_crystal', amount: 2, label: 'ちからの クリスタル' },
    ],
    exits: [
      { x: 8, y: 1,  to: 'shrine_forest_3f', tx: 8, ty: 15 },
      { x: 8, y: 16, to: 'shrine_forest_1f', tx: 8, ty: 2 },
    ],
    encounter: {
      rate: 0.10,
      enemies: ['moss_golem', 'forest_crow', 'thorn_goblin'],
      rare: { rate: 0.05, enemies: ['emerald_deer'] },
    },
  },

  shrine_forest_3f: {
    id: 'shrine_forest_3f',
    name: 'もりの しんでん さいじょうかい',
    ambient: 'forest',
    cutscenes: [
      { flag: 'cs_win_forest', requireFlag: 'boss_forest', pages: [
        '森の守り神 ガイアは\nみんなに ちからを たくして きえた。',
        'ユイト「ここまで これたのは\nみんなが いたからだ。」',
        'イクマ「けっせんだ ユイト。\nやみのしろへ、いこう！」',
      ] },
    ],
    grid: [
      'VVVVVVVVVVVVVVVV', // r0
      'VMMMMMMMMMMMMMMV', // r1  北の扉(8,1)→やみのしろ／ロック宝(12,1)
      'VMMMMMMMMMMMMMMV', // r2  (8,2)=やみのしろから来た到着
      'VMMMMMMMMMMMMMMV', // r3  ボスNPC 森の守り神(8,3)
      'VMMMMMMMMMMMMMMV', // r4
      'VMMMVVVMMVVVMMMV', // r5
      'VMMMMMMMMMMMMMMV', // r6
      'VMMMMMMMMMMMMMMV', // r7
      'VVMMMMMMMMMMMMVV', // r8
      'VMMMMMMMMMMMMMMV', // r9
      'VMMMMMMMMMMMMMMV', // r10
      'VMMMVVVMMVVVMMMV', // r11
      'VMMMMMMMMMMMMMMV', // r12
      'VMMMMMMMMMMMMMMV', // r13
      'VHVMMMMMMMMMMMMV', // r14  かくし通路 H(1,14)
      'VMVMMMMMMMMMMMMV', // r15  隠し宝(1,15)／(8,15)=2Fからの到着
      'VVMMMMMMMMMMMMMV', // r16  帰還(8,16)→2F
      'VVVVVVVVVVVVVVVV', // r17
    ],
    npcs: [
      {
        x: 8, y: 3, sprite: 'kaiser',
        boss: {
          enemies: ['forest_guardian'],
          winFlag: 'boss_forest', vanishFlag: 'boss_forest',
          reward: { item: 'leaf_blade', amount: 1, label: 'こもれびの つるぎ' },
        },
        pages: [
          'みどりの ひかりが\nしんでんを つつんでいる…',
          '森の守り神\n「この もりの おくへ\nすすもうとする ものよ。」',
          '「わが ちからを こえて みせよ！\nみどりの いかずちを うけよ！」',
        ],
        afterPages: ['森の守り神は しずかに うなずき\nひかりとなって きえていった。\nやみのしろへの みちが ひらいた！'],
      },
    ],
    chests: [
      {
        id: 'shrine3f_chest_boss', x: 12, y: 1, item: 'bark_mail', amount: 1, label: 'はがねの きのよろい',
        requireFlag: 'boss_forest',
        lockedMsg: 'つたが からみついて\nびくとも しない。\n森の守り神を たおせば\nほどけそうだ…',
      },
      { id: 'shrine3f_chest_hidden', x: 1, y: 15, item: 'mat_star', amount: 1, label: 'でんせつの ほし' },
    ],
    exits: [
      {
        x: 8, y: 1, to: 'ch2_castle', tx: 7, ty: 15,
        requireFlag: 'boss_forest',
        lockedMsg: 'やみのしろへの もんは\nみどりの ちからで とじている。\n森の守り神を たおせば\nひらく かもしれない…',
      },
      { x: 8, y: 16, to: 'shrine_forest_2f', tx: 8, ty: 2 },
    ],
    encounter: {
      rate: 0.10,
      enemies: ['moss_golem', 'forest_crow', 'thorn_goblin'],
      rare: { rate: 0.05, enemies: ['emerald_deer'] },
    },
  },

  // ── town2：フォレストタウン（field3 と field4 のあいだ・森の町） ────────
  town2: {
    id: 'town2',
    name: 'フォレストタウン',
    ambient: 'leaves',   // 落ち葉：木の葉がひらひら舞う
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
        variants: [
          { requireFlag: 'boss_guardian', pages: [
            'あめの レイニーピッチに\nでんせつの GKが いるって\nうわさだよ。',
          ] },
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
      // リフティングコーチ（機能③・ミニゲーム）：話すと リフティングに ちょうせんできる。
      {
        x: 6, y: 14, sprite: 'coach',
        lifting: {
          winFlag: 'lifting_master', target: 15, lives: 3,
          reward: { gold: 250, item: 'jelly', amount: 4, label: 'エナジーゼリー4こ' },
        },
        pages: [
          'おっす！ リフティングコーチだ。',
          'ボールを おとさず 15かい つづけられるかな？\nまん中で けってい/↑ を おすんだ！',
          'まん中に ちかいほど よく つづくよ。\nさあ、ちょうせん してみよう！',
        ],
        afterPages: ['また リフティングで あそぼう！\nあしさばきの れんしゅうだ。'],
      },
      // まとあてコーチ（機能③・ミニゲーム）：話すと まとあてシュートに ちょうせんできる。
      {
        x: 9, y: 14, sprite: 'coach',
        shoot: {
          winFlag: 'shoot_master', target: 8, shots: 12,
          reward: { gold: 350, item: 'firstaid', amount: 3, label: 'きゅうきゅうセット3こ' },
        },
        pages: [
          'よう！ まとあてコーチだ。',
          'ゴールの ひかる まとを ねらって シュート！\n12本ちゅう 8ヒット できたら きみの かちだ。',
          '←→↑↓で カーソルを うごかして\nけっていで シュート！ さあ いくぞ！',
        ],
        afterPages: ['また まとあてで あそぼう！\nシュートの せいどを あげような。'],
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
      // みずの どうくつ の道しるべ（入口(2,16)のすぐ上）：任意ダンジョンの場所を おしえる村人。
      {
        x: 2, y: 14, sprite: 'shopkeep',
        pages: [
          'にしの いわばに、ふかい あなが\nあいているのを しってるかい？',
          '「みずの どうくつ」って よばれてる。\nそこを おりていくと、ちていこが\nひろがっているらしいよ。',
          'おくには つよい ぬしが いるけど…\nおたからも ねむってるって うわささ！',
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
      { x: 7, y: 1, to: 'field3', tx: 7, ty: 15, msg: 'サンドコートへ もどる…' },
      { x: 7, y: 16, to: 'field4', tx: 7, ty: 2,
        requireFlag: 'boss_water',
        lockedMsg: 'みずの ちからで とざされている。\nみずのどうくつの ぬしを たおすと\nみちが ひらきそうだ…' },
      // 任意ダンジョン「みずの どうくつ」へ：西の岩場の入口(2,16)→cave_water_1f(8,15)に到着。
      { x: 2, y: 16, to: 'cave_water_1f', tx: 8, ty: 15 },
    ],
    encounter: { rate: 0, enemies: [] },
  },

  // ── Phase7-⑥「みずの どうくつ」：town2 から いける 任意の多層ダンジョン（3層）──
  //   ambient:'rain' ＝ 青い減光＋しずくのような すじ＝じめじめした 地底の水洞窟。
  //   新タイル a=浅瀬(歩ける・さざ波)／既存 c=洞窟ゆか, C=洞窟かべ(かたい), ~=ふかい水(通れない), b=橋(歩ける), H=かくし通路。
  //   本線(7ボスのスパイン)には つながない＝寄り道専用。objectiveFor の目標バーには出さない。
  cave_water_1f: {
    id: 'cave_water_1f',
    name: 'みずの どうくつ ちかいっかい',
    ambient: 'rain',
    grid: [
      'CCCCCCCCCCCCCCCC', // r0
      'CccccccccccccccC', // r1  上り階段(8,1)→2F
      'CccccccccccccccC', // r2  (8,2)=2Fから降りた到着
      'CccCCcccccCCcccC', // r3
      'Ccc~~ccccc~~cccC', // r4  ふかい水の ふち
      'Ccc~accccca~cccC', // r5
      'CccaaacccaaacccC', // r6  ← 中央は あさい みずうみ
      'CccaaaaaaaaacccC', // r7
      'CccaaaaaaaaacccC', // r8  道中宝(5,8)＝浅瀬の たからばこ
      'CccaaaaaaaaacccC', // r9
      'CccaaacccaaacccC', // r10
      'Ccc~accccca~cccC', // r11
      'Ccc~~ccccc~~cccC', // r12
      'CccCCcccccCCcccC', // r13
      'CHCccccccccccccC', // r14  かくし通路 H(1,14)→隠し宝
      'CcCccccccccccccC', // r15  隠し宝(1,15)／(8,15)=町からの到着
      'CCcccccccccccccC', // r16  帰還(8,16)→town2
      'CCCCCCCCCCCCCCCC', // r17
    ],
    npcs: [],
    chests: [
      { id: 'cavew1f_chest1', x: 5, y: 8, item: 'firstaid', amount: 2, label: 'きゅうきゅうセット' },
      { id: 'cavew1f_chest_hidden', x: 1, y: 15, item: 'mat_gold', amount: 2, label: 'こがねの かけら' },
    ],
    exits: [
      { x: 8, y: 1,  to: 'cave_water_2f', tx: 8, ty: 15 },
      { x: 8, y: 16, to: 'town2',         tx: 3, ty: 16 },
    ],
    encounter: {
      rate: 0.10,
      enemies: ['aqua_slime', 'tide_fox', 'whirl_wisp'],
      rare: { rate: 0.05, enemies: ['pearl_turtle'] },
    },
  },

  cave_water_2f: {
    id: 'cave_water_2f',
    name: 'みずの どうくつ ちかにかい',
    ambient: 'rain',
    grid: [
      'CCCCCCCCCCCCCCCC', // r0
      'CccccccccccccccC', // r1  上り階段(8,1)→3F
      'CccccccccccccccC', // r2  (8,2)=3Fから降りた到着
      'CccaaaaaaaaacccC', // r3  あさせ
      'CccaaaaaaaaacccC', // r4
      'CccccccccccccccC', // r5
      'Ccc~~~~bb~~~~ccC', // r6  ふかい水路＋はし(7,8列)
      'Ccc~~~~bb~~~~ccC', // r7
      'CccccccccccccccC', // r8
      'CccaaaaaaaaacccC', // r9  道中宝(8,9)＝はしの むこうの あさせ
      'CccaaaaaaaaacccC', // r10
      'CccccccccccccccC', // r11
      'CccCCcccccCCcccC', // r12
      'CccCCcccccCCcccC', // r13
      'CHCccccccccccccC', // r14  かくし通路 H(1,14)
      'CcCccccccccccccC', // r15  隠し宝(1,15)／(8,15)=1Fからの到着
      'CCcccccccccccccC', // r16  帰還(8,16)→1F
      'CCCCCCCCCCCCCCCC', // r17
    ],
    npcs: [],
    chests: [
      { id: 'cavew2f_chest1', x: 8, y: 9, item: 'restart_whistle', amount: 1, label: 'リスタートの笛' },
      { id: 'cavew2f_chest_hidden', x: 1, y: 15, item: 'mat_crystal', amount: 2, label: 'ちからの クリスタル' },
    ],
    exits: [
      { x: 8, y: 1,  to: 'cave_water_3f', tx: 8, ty: 15 },
      { x: 8, y: 16, to: 'cave_water_1f', tx: 8, ty: 2 },
    ],
    encounter: {
      rate: 0.10,
      enemies: ['aqua_slime', 'tide_fox', 'whirl_wisp'],
      rare: { rate: 0.05, enemies: ['pearl_turtle'] },
    },
  },

  cave_water_3f: {
    id: 'cave_water_3f',
    name: 'みずの どうくつ さいかそう',
    ambient: 'rain',
    grid: [
      'CCCCCCCCCCCCCCCC', // r0
      'CccccccccccccccC', // r1  ロック宝(6,1)＝ボス撃破で解除
      'CccccccccccccccC', // r2
      'CccccccccccccccC', // r3  ボスNPC(8,3)
      'CccccccccccccccC', // r4
      'Ccc~~ccccc~~cccC', // r5  ボス部屋を かこむ 水たまり
      'Cccc~~ccc~~ccccC', // r6
      'CccccaaaaacccccC', // r7  中央の あさせ
      'CccccaaaaacccccC', // r8
      'CccccaaaaacccccC', // r9
      'Cccc~~ccc~~ccccC', // r10
      'Ccc~~ccccc~~cccC', // r11
      'CccccccccccccccC', // r12
      'CccccccccccccccC', // r13
      'CHCccccccccccccC', // r14  かくし通路 H(1,14)
      'CcCccccccccccccC', // r15  隠し宝(1,15)／(8,15)=2Fからの到着
      'CCcccccccccccccC', // r16  帰還(8,16)→2F
      'CCCCCCCCCCCCCCCC', // r17
    ],
    npcs: [
      {
        x: 8, y: 3, sprite: 'kaiser',
        boss: {
          enemies: ['aqua_golem'],
          winFlag: 'boss_water', vanishFlag: 'boss_water',
          reward: { item: 'tide_spike', amount: 1, label: 'うしおの スパイク' },
        },
        pages: [
          'ちていこの みずが\nゆらゆらと ひかっている…',
          'アクア・ゴーレム\n「ちていこの しずけさを\nやぶる ものは だれだ！」',
          '「みずの いかりを おもいしれ！」',
        ],
        afterPages: ['アクア・ゴーレムは くずれ\nしずかな みずに もどった。'],
      },
    ],
    chests: [
      {
        id: 'cavew3f_chest_boss', x: 6, y: 1, item: 'coral_mail', amount: 1, label: 'さんごの よろい',
        requireFlag: 'boss_water',
        lockedMsg: 'みずの ちからで かたく\nとざされている。\nゴーレムを たおせば\nひらきそうだ…',
      },
      { id: 'cavew3f_chest_hidden', x: 1, y: 15, item: 'mat_star', amount: 1, label: 'でんせつの ほし' },
    ],
    exits: [
      { x: 8, y: 16, to: 'cave_water_2f', tx: 8, ty: 2 },
    ],
    encounter: {
      rate: 0.10,
      enemies: ['aqua_slime', 'tide_fox', 'whirl_wisp'],
      rare: { rate: 0.05, enemies: ['pearl_turtle'] },
    },
  },

  // ── town3：クラウドタウン（field5 と field6 のあいだ・決戦まえの空の町） ─
  town3: {
    id: 'town3',
    name: 'クラウドタウン',
    ambient: 'sky',   // 空：雲の上の町＋きらめき
    isTown: true,
    // 最後の町・カットシーン（弾4）：決戦まえの しずかな ひとときを 一度だけ。
    cutscene: {
      flag: 'cs_town3',
      pages: [
        'くもの うえの まち、\nクラウドタウン。\nこの さきは けっせんだ。',
        'まちの ひとびとが、\nしずかに ユイトたちを\nみまもって いる。',
        'みなで そらを みあげる。\nどこか とおくで、ボールを\nける おとが きこえた。',
        'それは きっと おうごんの\nボールが よんでいる おと。',
        'ユイト「あと すこしだ。\nぜったいに とりもどして\nみせる。」',
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
        variants: [
          {
            requireFlag: 'boss_dark_general',
            pages: [
              'やみの しょうぐんを たおしたの!?\nこの まちも これで あんしんだ！',
              'のこるは ダーク・カイザーだけ。\nさいごまで きを ぬくなよ！',
            ],
          },
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
      { x: 6, y: 1, to: 'field5', tx: 7, ty: 15, msg: 'スカイスタジアムへ もどる…' },
      { x: 7, y: 16, to: 'field6', tx: 7, ty: 2,
        requireFlag: 'boss_emperor',
        lockedMsg: 'でんせつの アリーナの ぬしを\nたおさないと、この さきへは\nすすめないようだ…\nゴールド・エンペラーに いどもう！' },
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
    ambient: 'night',   // 夜：星＋ほたるで荘厳に
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
          enemies: ['guardian', 'gold_emperor'],
          winFlag: 'challenge_clear',
          reward: { item: 'champion_spike', amount: 1, label: 'チャンピオンシューズ' },
        },
        pages: [
          'ここは ちょうせんの間。',
          'ダーク・カイザーに いどむ まえの\nさいごの うでだめしだ！',
          'これまで たおした ボスが\n2たい つづけて おそいかかる。\nとちゅうで HP・MPは かいふく できない！',
          'うでだめしに ちょうせん する？',
        ],
        afterPages: [
          'うでだめし クリア！\nきみは カイザーに いどむ\nしかくを てに いれた！',
          'いよいよ ダーク・カイザーだ。\nゆだんせず いどもう！',
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
    ambient: 'embers',   // 火の粉：やみの気配
    // 第2章 導入カットシーン：たおしたはずの やみが ふたたび――。
    cutscene: {
      flag: 'cs_ch2_gate',
      pages: [
        'ダーク・カイザーを たおし、\nまちには へいわが もどった――\nはずだった。',
        'だが きたの そらに、\nくろい うずが ひろがっていく。',
        'たおしたはずの やみが、\nふたたび よみがえったのだ。',
        'やみの もんの むこうから\nつめたい きはいが ながれてくる。',
        '― だい2しょう ―\n「やみの ぎゃくしゅう」',
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
    ambient: 'snow',   // 雪：ゆきがちらつく北の町
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
        x: 6, y: 15, sprite: 'coach', guide: true,
        pages: ['だい2しょうも\nコーチが ついてるぞ！'],
      },
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
      {
        x: 13, y: 9, sprite: 'coach',
        pages: [
          'ひがしの はずれに\n「こおりの とう」が あるんだ。',
          'てっぺんには つよい\nアイス・ゴーレムが いるらしい。',
          'たおせば すごい たからが\nてに はいるって うわさだよ！',
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
      { x: 14, y: 8, to: 'tower_ice_1f', tx: 8, ty: 15,
        requireFlag: 'boss_dark_general',
        lockedMsg: 'こおりの とうの とびらは\nこおりついて ひらかない。\nまずは こおりの とうげで\nやみの しょうぐん ヴォルクを\nたおそう！' }, // 東：こおりの とう 入口
    ],
    encounter: { rate: 0, enemies: [] },
  },

  // ── ch2_pass：こおりの とうげ（中ボス：やみの しょうぐん ヴォルク） ──────
  //   ヴォルク(7,4)を たおすと 北のとびらが ひらく。
  ch2_pass: {
    id: 'ch2_pass',
    name: 'こおりの とうげ',
    ambient: 'snow',   // 雪：ふぶく氷の峠
    cutscenes: [
      { flag: 'cs_win_dark_general', requireFlag: 'boss_dark_general', pages: [
        'やみの しょうぐん ヴォルクは\nふぶきの なかへ きえた。',
        'アオシ「5人 そろえば、\nこんな つよい てきにも かてる。」',
        'ユイト「きずなの ちからだ。\nこの とうげを こえて さきへ すすもう！」',
      ] },
    ],
    grid: [
      '################', // r0
      '#......,.......#', // r1  ← 北出口(7,1)→ shrine_forest_1f（要 boss_ice）
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
        x: 7, y: 1, to: 'shrine_forest_1f', tx: 8, ty: 15,
        requireFlag: 'boss_ice',
        lockedMsg: 'きたへの みちは とざされている。\nこおりの とうの ぬし\nアイス・ゴーレムを たおせば\nもりの しんでんへ すすめそうだ…',
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
    ambient: 'embers',   // 火の粉：ラスダンの緊張感
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
      '#......,.......#', // r15 ← 到着(7,15)＝もりの しんでん 3Fから
      '#......,.......#', // r16 ← 南出口(7,16)→ shrine_forest_3f
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
        boss: {
          enemies: ['neo_kaiser'],
          winFlag: 'boss_neo_kaiser',
          vanishFlag: 'boss_neo_kaiser',
          // ending は出さない。地続きで第3章（せかいたいかい）へ。
          afterPages: [
            'ネオ・カイザーは、やみの\nかなたへ きえていった……',
            'よみがえった やみが、\nこんどこそ ほろびたのだ。',
            'まちに ひかりが もどり、\nおうごんの ボールが\nふたたび こがねに かがやく。',
            'そのとき――\nそらの おくで なにかが\nキラリと またたいた きがした。',
            'ユイト「……きのせいかな。\nさあ、つぎは ほんものの\nせかいたいかいだ！」',
            'ユイト「せかい一に なって\nこの おうごんの ボールで\nみんなを えがおに するぞ！」',
            'こうして ユイトたちは\nにっぽん だいひょうとして\nグランドスタジアムへ むかった。',
          ],
          warpTo: 'wc_stadium', warpX: 7, warpY: 15,
          setFlag: 'ch3_start',
        },
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
      { x: 7, y: 16, to: 'shrine_forest_3f', tx: 8, ty: 2 },
    ],
    encounter: {
      rate: 0.06,
      enemies: ['shadow_beast', 'curse_wisp'],
      rare: { rate: 0.04, enemies: ['chaos_orb'] },
    },
  },

  // ══════════════════════════════════════════════════════════════
  //  第3章 S1：せかいたいかい（グランドスタジアム）
  //   同一マップ内の4試合NPCを requireFlag で一本道化する。
  //   予選(wc_qualify)→準々(wc_quarter)→準決(wc_semi)→決勝ヴォルグ(boss_volg)。
  //   決勝で勝つと ネビュラごう(nebula_f1) へ 地続きワープ。
  // ══════════════════════════════════════════════════════════════
  wc_stadium: {
    id: 'wc_stadium',
    name: 'グランドスタジアム',
    cutscene: {
      flag: 'cs_wc',
      pages: [
        '―― グランドスタジアム。\nせかいじゅうの つよ者が\nあつまる ゆめのぶたい。',
        'ユイト「ここで せかい一を\nきめるんだ！」',
      ],
    },
    grid: [
      '################', // r0
      '#......,.......#', // r1
      '#......,.......#', // r2
      '#......,.......#', // r3
      '#......,.......#', // r4
      '#......,.......#', // r5
      '#......,.......#', // r6  ← 予選(4,6)／準々(8,6)
      '#......,.......#', // r7
      '#......,.......#', // r8
      '#......,.......#', // r9
      '#......,.......#', // r10 ← 準決(4,10)／決勝(8,10)／もどる到着(7,10)
      '#......,.......#', // r11
      '#......,.......#', // r12
      '#......,.......#', // r13
      '#......,.......#', // r14
      '#......,.......#', // r15 ← 到着(7,15)＝やみのしろ から
      '#......,.......#', // r16 ← 南出口(7,16)→ ch2_castle
      '################', // r17
    ],
    npcs: [
      {
        x: 6, y: 15, sprite: 'coach', guide: true,
        pages: ['いよいよ せかいたいかい！\nひとつずつ かって\nてっぺんを めざそう！'],
      },
      {
        x: 4, y: 6, sprite: 'coach',
        boss: { enemies: ['rival_ace'], winFlag: 'wc_qualify',
          afterPages: ['よせん とっぱ！\nつぎは 準々けっしょうだ！'] },
        pages: ['よせんの あいてだ！\nかって すすもう！'],
      },
      {
        x: 8, y: 6, sprite: 'phantom_striker',
        boss: { enemies: ['rival_ace', 'rival_ace'], winFlag: 'wc_quarter',
          afterPages: ['準々けっしょう とっぱ！\nつぎは 準けっしょうだ！'] },
        requireFlag: 'wc_qualify', lockedMsg: 'まず よせんに かとう！',
        pages: ['準々けっしょうの あいてだ！'],
      },
      {
        x: 4, y: 10, sprite: 'phantom_striker',
        boss: { enemies: ['rival_ace', 'rival_ace'], winFlag: 'wc_semi',
          afterPages: ['準けっしょう とっぱ！\nいよいよ けっしょうせん！'] },
        requireFlag: 'wc_quarter', lockedMsg: '準々けっしょうが さきだ！',
        pages: ['準けっしょう、あいては 2にん！'],
      },
      {
        x: 8, y: 10, sprite: 'kaiser',
        boss: {
          enemies: ['volg'], winFlag: 'boss_volg', vanishFlag: 'boss_volg',
          afterPages: [
            'ユイトたちは せかい一に\nかがやいた！',
            'そのとき――\nそらが われ、まっくろな\nうちゅうせんが あらわれた！',
            '「ちきゅうの サッカーは\nわれわれ うちゅうぐんが\nいただく！」',
            'ユイト「なんだ あれ…！？\nみんな、ネビュラごうに\nのりこむぞ！」',
          ],
          warpTo: 'nebula_f1', warpX: 7, warpY: 16, setFlag: 'wc_semi',
        },
        requireFlag: 'wc_semi', lockedMsg: '準けっしょうを かってから！',
        pages: ['けっしょう！\nれっかの ヴォルグだ！'],
      },
    ],
    objects: [
      { x: 1,  y: 1,  type: 'goal', solid: true },
      { x: 14, y: 1,  type: 'goal', solid: true },
      { x: 5,  y: 8,  type: 'ball'  },
      { x: 9,  y: 8,  type: 'ball'  },
      { x: 2,  y: 13, type: 'flower' },
      { x: 13, y: 13, type: 'flower' },
    ],
    exits: [
      { x: 7, y: 16, to: 'ch2_castle', tx: 7, ty: 15, msg: 'やみのしろへ もどる…' },
    ],
    encounter: { rate: 0, enemies: [] },
  },

  // ══════════════════════════════════════════════════════════════
  //  第3章 S2：うちゅうせん ネビュラごう（3フロア一本道）
  //   各フロアのボスNPCを たおすと 前進出口(requireFlag)が ひらく。
  //   ブリッジ(nebula_f3)で ゼロス撃破→ star_boots(atk40)→ 星辰の神殿へワープ。
  // ══════════════════════════════════════════════════════════════
  nebula_f1: {
    id: 'nebula_f1',
    name: 'ネビュラごう 第1フロア',
    ambient: 'embers',
    cutscene: {
      flag: 'cs_nebula',
      pages: [
        '―― うちゅうせん ネビュラごう。\nつめたい きんぞくの つうろが\nどこまでも つづく。',
        'ユイト「この ふねを とめれば\nちきゅうは まもれる はずだ！」',
      ],
    },
    grid: [
      '################', // r0
      '#......,.......#', // r1  ← 北出口(7,1)→ nebula_f2
      '#......,.......#', // r2
      '#......,.......#', // r3
      '#......,.......#', // r4
      '#......,.......#', // r5
      '#......,.......#', // r6
      '#......,.......#', // r7
      '#......,.......#', // r8  ← きかいへい(7,8)
      '#......,.......#', // r9
      '#......,.......#', // r10
      '#......,.......#', // r11
      '#......,.......#', // r12
      '#......,.......#', // r13
      '#......,.......#', // r14
      '#......,.......#', // r15
      '#......,.......#', // r16 ← 到着(7,16)＝スタジアムから
      '################', // r17
    ],
    npcs: [
      {
        x: 7, y: 8, sprite: 'coach',
        boss: { enemies: ['mecha_soldier', 'mecha_drone'], winFlag: 'nebula_f1',
          afterPages: ['きかいへいを たおした！\nおくへ すすもう！'] },
        pages: ['きかいへいが ゆくてを ふさぐ！'],
      },
    ],
    exits: [
      { x: 7, y: 1,  to: 'nebula_f2', tx: 7, ty: 16, requireFlag: 'nebula_f1',
        lockedMsg: 'きかいへいを たおさないと\nさきへ すすめない！' },
      { x: 7, y: 16, to: 'wc_stadium', tx: 7, ty: 10, msg: 'スタジアムへ もどる…' },
    ],
    encounter: { rate: 0.09, enemies: ['mecha_soldier', 'mecha_drone'] },
  },
  nebula_f2: {
    id: 'nebula_f2',
    name: 'ネビュラごう 第2フロア',
    ambient: 'embers',
    grid: [
      '################', // r0
      '#......,.......#', // r1  ← 北出口(7,1)→ nebula_f3
      '#......,.......#', // r2
      '#......,.......#', // r3
      '#......,.......#', // r4
      '#......,.......#', // r5
      '#......,.......#', // r6
      '#......,.......#', // r7
      '#......,.......#', // r8  ← きかいへい(7,8)
      '#......,.......#', // r9
      '#......,.......#', // r10
      '#......,.......#', // r11
      '#......,.......#', // r12
      '#......,.......#', // r13
      '#......,.......#', // r14
      '#......,.......#', // r15
      '#......,.......#', // r16 ← 到着(7,16)
      '################', // r17
    ],
    npcs: [
      {
        x: 7, y: 8, sprite: 'phantom_striker',
        boss: { enemies: ['mecha_soldier', 'mecha_soldier'], winFlag: 'nebula_f2',
          afterPages: ['ここも とっぱ！\nブリッジは もう すぐだ！'] },
        pages: ['さらに つよい きかいへい だ！'],
      },
    ],
    exits: [
      { x: 7, y: 1,  to: 'nebula_f3', tx: 7, ty: 16, requireFlag: 'nebula_f2',
        lockedMsg: 'ここの きかいへいを\nたおしてから！' },
      { x: 7, y: 16, to: 'nebula_f1', tx: 7, ty: 2, msg: '第1フロアへ もどる…' },
    ],
    encounter: { rate: 0.09, enemies: ['mecha_soldier', 'mecha_drone'] },
  },
  nebula_f3: {
    id: 'nebula_f3',
    name: 'ネビュラごう ブリッジ',
    ambient: 'embers',
    grid: [
      '################', // r0
      '#......,.......#', // r1
      '#......,.......#', // r2
      '#......,.......#', // r3  ← ゼロス(7,3)
      '#......,.......#', // r4
      '#......,.......#', // r5
      '#......,.......#', // r6  ← きかいへい(7,6)
      '#......,.......#', // r7
      '#......,.......#', // r8
      '#......,.......#', // r9
      '#......,.......#', // r10
      '#......,.......#', // r11
      '#......,.......#', // r12
      '#......,.......#', // r13
      '#......,.......#', // r14
      '#......,.......#', // r15
      '#......,.......#', // r16 ← 到着(7,16)
      '################', // r17
    ],
    npcs: [
      {
        x: 7, y: 6, sprite: 'phantom_striker',
        boss: { enemies: ['mecha_soldier', 'mecha_drone', 'mecha_drone'], winFlag: 'nebula_f3',
          afterPages: ['ブリッジへの みちが ひらいた！'] },
        pages: ['ブリッジへの さいごの かべ！'],
      },
      {
        x: 7, y: 3, sprite: 'kaiser',
        boss: {
          enemies: ['zeros'], winFlag: 'boss_zeros', vanishFlag: 'boss_zeros',
          reward: { item: 'star_boots', amount: 1, label: 'せいなるブーツ' },
          afterPages: [
            'ゼロスは しずかに とまった。',
            'どこからか こえが ひびく…',
            '「よくぞ ここまで…\nおうごんの ボールの\nしんじつを みせよう。」',
            'ひかりに つつまれ、ユイトたちは\nほしの かなたへ みちびかれた。',
          ],
          warpTo: 'star_shrine_1', warpX: 7, warpY: 16, setFlag: 'nebula_f3',
        },
        requireFlag: 'nebula_f3', lockedMsg: 'まず この フロアの\nきかいへいを たおそう！',
        pages: ['メカ・エンペラー ゼロス！'],
      },
    ],
    exits: [
      { x: 7, y: 16, to: 'nebula_f2', tx: 7, ty: 2, msg: '第2フロアへ もどる…' },
    ],
    encounter: { rate: 0.07, enemies: ['mecha_soldier', 'mecha_drone'] },
  },

  // ── 第3章 S3：せいしんの しんでん（試練3つ→アステリオン→真ED） ──
  star_shrine_1: {
    id: 'star_shrine_1', name: 'せいしんの しんでん 試練の間', ambient: 'embers',
    cutscene: { flag: 'cs_shrine', pages: [
      '―― ほしの かなた、せいしんの しんでん。',
      'おうごんの ボールの\nはじまりの ばしょ。',
    ]},
    grid: [
      'VVVVVVVVVVVVVVVV', // r0
      'VMMMMMMMMMMMMMMV', // r1  北出口(7,1)→star_shrine_2
      'VMMMMMMMMMMMMMMV', // r2
      'VMMTTMMMMMMTTMMV', // r3
      'VMMTMMMMMMMMTMMV', // r4
      'VMMMMMMMMMMMMMMV', // r5
      'VMMMMMTTTTMMMMMV', // r6
      'VMMMMMMMMMMMMMMV', // r7
      'VMMTTMMMMMMTTMMV', // r8  試練1 まもりて(7,8)
      'VMMTMMMMMMMMTMMV', // r9
      'VMMMMMMMMMMMMMMV', // r10
      'VMMMMMMMMMMMMMMV', // r11
      'VMMMMMMMMMMMMMMV', // r12
      'VMMMMMMMMMMMMMMV', // r13
      'VMMMMMMMMMMMMMMV', // r14
      'VMMMMMMMMMMMMMMV', // r15
      'VMMMMMMMMMMMMMMV', // r16  南出口(7,16)→nebula_f3
      'VVVVVVVVVVVVVVVV', // r17
    ],
    npcs: [
      { x: 7, y: 8, sprite: 'phantom_striker',
        boss: { enemies: ['star_sentinel'], winFlag: 'trial_1' },
        pages: ['試練その1。\nまもりてを たおせ！'] },
    ],
    exits: [
      { x: 7, y: 1, to: 'star_shrine_2', tx: 7, ty: 16, requireFlag: 'trial_1',
        lockedMsg: '試練1を こえてから！' },
      { x: 7, y: 16, to: 'nebula_f3', tx: 7, ty: 4, msg: 'ネビュラごうへ もどる…' },
    ],
    encounter: { rate: 0.09, enemies: ['star_sentinel'] },
  },
  star_shrine_2: {
    id: 'star_shrine_2', name: 'せいしんの しんでん 星の回廊', ambient: 'embers',
    grid: [
      'VVVVVVVVVVVVVVVV', // r0
      'VMMMMMMMMMMMMMMV', // r1  北出口(7,1)→star_shrine_3
      'VMMMMMMMMMMMMMMV', // r2
      'VMMTTMMMMMMTTMMV', // r3
      'VMMTMMMMMMMMTMMV', // r4
      'VMMMMMMMMMMMMMMV', // r5  star_mail チェスト(3,5)
      'VMMMMMTTTTMMMMMV', // r6
      'VMMMMMMMMMMMMMMV', // r7
      'VMMTTMMMMMMTTMMV', // r8  試練2 まもりて×2(7,8)
      'VMMTMMMMMMMMTMMV', // r9
      'VMMMMMMMMMMMMMMV', // r10
      'VMMMMMMMMMMMMMMV', // r11
      'VMMMMMMMMMMMMMMV', // r12
      'VMMMMMMMMMMMMMMV', // r13
      'VMMMMMMMMMMMMMMV', // r14
      'VMMMMMMMMMMMMMMV', // r15
      'VMMMMMMMMMMMMMMV', // r16  南出口(7,16)→star_shrine_1
      'VVVVVVVVVVVVVVVV', // r17
    ],
    npcs: [
      { x: 7, y: 8, sprite: 'phantom_striker',
        boss: { enemies: ['star_sentinel', 'star_sentinel'], winFlag: 'trial_2' },
        pages: ['試練その2。\nまもりては 2たい！'] },
    ],
    chests: [
      { id: 'shrine_star_mail', x: 3, y: 5, item: 'star_mail', amount: 1, label: 'せいなるよろい',
        requireFlag: 'trial_1', lockedMsg: 'まだ ひらかない…' },
    ],
    exits: [
      { x: 7, y: 1, to: 'star_shrine_3', tx: 7, ty: 16, requireFlag: 'trial_2',
        lockedMsg: '試練2を こえてから！' },
      { x: 7, y: 16, to: 'star_shrine_1', tx: 7, ty: 2, msg: '試練の間へ もどる…' },
    ],
    encounter: { rate: 0.09, enemies: ['star_sentinel'] },
  },
  star_shrine_3: {
    id: 'star_shrine_3', name: 'せいしんの しんでん さいおく', ambient: 'embers',
    grid: [
      'VVVVVVVVVVVVVVVV', // r0
      'VMMMMMMMMMMMMMMV', // r1
      'VMMMMMMMMMMMMMMV', // r2
      'VMMTTMMMMMMTTMMV', // r3  アステリオン(7,3)＝真ラスボス
      'VMMTMMMMMMMMTMMV', // r4
      'VMMMMMMMMMMMMMMV', // r5
      'VMMMMMTTTTMMMMMV', // r6
      'VMMMMMMMMMMMMMMV', // r7
      'VMMTTMMMMMMTTMMV', // r8  試練3 まもりて×2(7,8)
      'VMMTMMMMMMMMTMMV', // r9
      'VMMMMMMMMMMMMMMV', // r10
      'VMMMMMMMMMMMMMMV', // r11
      'VMMMMMMMMMMMMMMV', // r12
      'VMMMMMMMMMMMMMMV', // r13
      'VMMMMMMMMMMMMMMV', // r14
      'VMMMMMMMMMMMMMMV', // r15
      'VMMMMMMMMMMMMMMV', // r16  南出口(7,16)→star_shrine_2
      'VVVVVVVVVVVVVVVV', // r17
    ],
    npcs: [
      { x: 7, y: 8, sprite: 'phantom_striker',
        boss: { enemies: ['star_sentinel', 'star_sentinel'], winFlag: 'trial_3' },
        pages: ['試練その3。\nさいごの まもりて！'] },
      { x: 7, y: 3, sprite: 'kaiser',
        boss: { enemies: ['asterion'], winFlag: 'boss_asterion', vanishFlag: 'boss_asterion',
                ending: true },
        requireFlag: 'trial_3', lockedMsg: '試練3を こえてから！',
        pages: ['ほしくいの かみ アステリオン！\nさいしゅうけっせん だ！'] },
    ],
    exits: [
      { x: 7, y: 16, to: 'star_shrine_2', tx: 7, ty: 2, msg: '星の回廊へ もどる…' },
    ],
    encounter: { rate: 0.07, enemies: ['star_sentinel'] },
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
