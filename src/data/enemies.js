const ENEMIES = {
  foul_goblin: {
    id:'foul_goblin', name:'ファウルゴブリン', type:'power',
    hp:14, atk:6, def:2, spd:5, exp:4, gold:3,
    appears: [1, 2],
    drops: [{ id:'mat_iron', chance:0.45 }],
  },
  offside_ghost: {
    id:'offside_ghost', name:'オフサイドおばけ', type:'speed',
    hp:18, atk:8, def:3, spd:11, exp:7, gold:5,
    appears: [2, 3],
    drops: [{ id:'mat_leather', chance:0.45 }],
  },
  hand_monster: {
    id:'hand_monster', name:'ハンドモンスター', type:'power',
    hp:26, atk:9, def:8, spd:4, exp:10, gold:8,
    appears: [3, 4],
    drops: [{ id:'mat_iron', chance:0.4 }, { id:'mat_leather', chance:0.3 }],
  },
  yellowcard_bat: {
    id:'yellowcard_bat', name:'イエローカードコウモリ', type:'speed',
    hp:22, atk:10, def:4, spd:12, exp:12, gold:9,
    appears: [4, 5],
    skills: ['stun_bite'],
    drops: [{ id:'mat_leather', chance:0.4 }, { id:'mat_silver', chance:0.2 }],
  },
  redcard_devil: {
    id:'redcard_devil', name:'レッドカードデビル', type:'technique',
    hp:34, atk:14, def:6, spd:9, exp:18, gold:14,
    appears: [5],
    drops: [{ id:'mat_silver', chance:0.3 }, { id:'mat_crystal', chance:0.08 }],
  },

  // ── 追加ザコ（弾追加1）：サッカーモチーフ。タイプ相性が活きるよう power/speed/technique を散らす ──
  mud_slime: {
    id:'mud_slime', name:'ぬかるみスライム', type:'technique',
    hp:12, atk:5, def:3, spd:3, exp:5, gold:4,
    appears: [1, 2],
    drops: [{ id:'mat_iron', chance:0.4 }],
  },
  corner_crow: {
    id:'corner_crow', name:'コーナーカラス', type:'speed',
    hp:16, atk:9, def:2, spd:13, exp:9, gold:6,
    appears: [2, 3],
    drops: [{ id:'mat_leather', chance:0.45 }],
  },
  throwin_golem: {
    id:'throwin_golem', name:'スローインゴーレム', type:'power',
    hp:34, atk:10, def:11, spd:3, exp:15, gold:11,
    appears: [3, 4],
    drops: [{ id:'mat_iron', chance:0.45 }, { id:'mat_silver', chance:0.2 }],
  },
  losstime_ghost: {
    id:'losstime_ghost', name:'ロスタイムおばけ', type:'technique',
    hp:28, atk:13, def:5, spd:10, exp:17, gold:12,
    appears: [4, 5],
    drops: [{ id:'mat_silver', chance:0.28 }],
  },
  trick_fox: {
    id:'trick_fox', name:'トリックギツネ', type:'speed',
    hp:30, atk:16, def:6, spd:15, exp:21, gold:16,
    appears: [5, 6],
    drops: [{ id:'mat_silver', chance:0.3 }, { id:'mat_crystal', chance:0.1 }],
  },
  stamina_zombie: {
    id:'stamina_zombie', name:'スタミナぎれゾンビ', type:'power',
    hp:44, atk:17, def:10, spd:4, exp:25, gold:19,
    appears: [6],
    drops: [{ id:'mat_silver', chance:0.35 }, { id:'mat_crystal', chance:0.12 }],
  },
  pk_punisher: {
    id:'pk_punisher', name:'PKパニッシャー', type:'technique',
    hp:40, atk:19, def:8, spd:11, exp:28, gold:22,
    appears: [6],
    drops: [{ id:'mat_silver', chance:0.35 }, { id:'mat_crystal', chance:0.18 }],
  },

  // ── レアモンスター（弾追加1）：高防御・低HP・超高報酬。低確率で1体だけ出現（メタル系のお楽しみ枠） ──
  golden_ball: {
    id:'golden_ball', name:'きらめきサッカーボール', type:'technique',
    isRare: true,
    hp:10, atk:5, def:18, spd:22, exp:120, gold:100,
    drops: [{ id:'mat_crystal', chance:0.6 }, { id:'mat_gold', chance:0.3 }],
  },
  metal_keeper: {
    id:'metal_keeper', name:'メタルゴーレム', type:'power',
    isRare: true,
    hp:16, atk:7, def:28, spd:9, exp:170, gold:90,
    drops: [{ id:'mat_crystal', chance:0.6 }, { id:'mat_gold', chance:0.35 }],
  },

  guardian: {
    id:'guardian', name:'鉄壁キーパー ガーディアン', type:'power',
    isBoss: true,
    hp:120, atk:12, def:18, spd:4, exp:60, gold:80,
    drops: [{ id:'mat_gold', chance:1.0 }, { id:'mat_crystal', chance:0.5 }],
    // ボスセリフ（弾4・演出）：intro=戦闘開始の一言／defeat=やられぎわの一言
    quotes: {
      intro: ['「われの まもりを\nやぶって みよ！」'],
      defeat: '「みごとな こうげき…\nさきへ すすむが いい。」',
    },
  },
  dark_kaiser: {
    id:'dark_kaiser', name:'ダーク・カイザー', type:'technique',
    isBoss: true,
    hp:160, atk:16, def:10, spd:8, exp:200, gold:300,
    drops: [{ id:'mat_gold', chance:1.0 }, { id:'mat_crystal', chance:0.6 }, { id:'mat_star', chance:0.5 }],
    phases: [
      { atk:16, def:10, spd:8 },
      { hpRatio:0.5, atk:22, def:12, spd:11 },
    ],
    // ボスセリフ（弾4・演出）：phase=第2形態へ移行したときの一言も足す
    quotes: {
      intro: ['「やみの ちからに\nひれふせ！」'],
      phase: '「ぐぬぬ…\nならば ほんきを だす まで！」',
      defeat: '「ばかな… この おれが\nまけるとは…」',
    },
  },
  // ── 隠しボス（弾3）：ダークアリーナの かくし部屋に いる まぼろしの ストライカー ──
  phantom_striker: {
    id:'phantom_striker', name:'ファントム・ストライカー', type:'speed',
    isBoss: true,
    hp:200, atk:20, def:12, spd:14, exp:260, gold:200,
    drops: [{ id:'mat_gold', chance:1.0 }, { id:'mat_crystal', chance:0.7 }, { id:'mat_star', chance:0.7 }],
    phases: [
      { atk:20, def:12, spd:14 },
      { hpRatio:0.5, atk:28, def:14, spd:18 },
    ],
    quotes: {
      intro: ['「まぼろしの ぜんりょく、\nみせて やる！」'],
      phase: '「いいだろう…\nほんとうの すがたを みせよう！」',
      defeat: '「みごと…\nきみは ほんものの エースだ。」',
    },
  },
  // ── 専用ボス（追加弾3）：でんせつの アリーナ（legend_arena）の おくに いる
  //   さいきょうの エース。クリア後の やりこみ用・全ボス中 最強ステータス。
  //   倒すと flags.boss_emperor → 実績 beat_emperor 解除＋ごほうび こうていのブーツ。
  gold_emperor: {
    id:'gold_emperor', name:'ゴールド・エンペラー', type:'power',
    isBoss: true,
    hp:280, atk:24, def:16, spd:12, exp:400, gold:500,
    drops: [{ id:'mat_gold', chance:1.0 }, { id:'mat_crystal', chance:1.0 }, { id:'mat_star', chance:1.0 }],
    phases: [
      { atk:24, def:16, spd:12 },
      { hpRatio:0.5, atk:32, def:18, spd:16 },
    ],
    quotes: {
      intro: ['「わが おうごんの\nゆめを みせて やろう！」'],
      phase: '「すばらしい！\nならば ほんきの ぜんりょくだ！」',
      defeat: '「みごとだ…\nきみこそ しんの エースだ。」',
    },
  },

  // ── ダンジョンボス（Phase7-③：ほのおの どうくつ cave1 の ぬし） ───────
  //   art は throwin_golem（ゴーレム体型の絵）を流用＝新規アートは増やさない。
  //   倒すと flags.boss_magma → cave1 ボス部屋おくの宝箱(マグマよろい)が ひらく。
  magma_golem: {
    id:'magma_golem', name:'マグマ・ゴーレム', type:'power', art:'throwin_golem',
    isBoss: true,
    hp:80, atk:10, def:7, spd:5, exp:40, gold:35,
    drops: [{ id:'mat_gold', chance:1.0 }, { id:'mat_crystal', chance:0.7 }],
    quotes: {
      intro: ['「ようがんの ねむりを\nさました やつは だれだ！」'],
      phase: '「ぐおおお…\nもえあがれ マグマ！」',
      defeat: '「しずまる… また\nねむりに つくとしよう…」',
    },
  },

  // ── ダンジョン（Phase7-④：こおりの とう tower_ice_1f〜3f）の てきたち ────
  //   art は既存 ENEMY_ART のキーを流用＝新規アートは増やさない。
  //   ザコ3体（power/speed/technique を散らす）＋レア（silver_fox）＋ボス（ice_golem・2形態）。
  //   frost_keeper(こおりのキーパー)が すでに throwin_golem を使うので、氷の敵は別アートにする。
  snow_yeti: {
    id:'snow_yeti', name:'ゆきの イエティ', type:'power', art:'snow_yeti',
    hp:78, atk:25, def:14, spd:7, exp:66, gold:48,
    drops: [{ id:'mat_silver', chance:0.42 }, { id:'mat_crystal', chance:0.22 }],
  },
  blizzard_bat: {
    id:'blizzard_bat', name:'ふぶきコウモリ', type:'speed', art:'blizzard_bat',
    hp:52, atk:24, def:9, spd:19, exp:52, gold:38,
    drops: [{ id:'mat_leather', chance:0.4 }, { id:'mat_silver', chance:0.28 }],
  },
  frost_wisp: {
    id:'frost_wisp', name:'こおりの ひとだま', type:'technique', art:'frost_wisp',
    hp:56, atk:23, def:10, spd:14, exp:54, gold:40,
    drops: [{ id:'mat_silver', chance:0.4 }, { id:'mat_crystal', chance:0.18 }],
  },
  // レアモンスター（氷の塔）：超高報酬・高防御・高速。低確率で1体だけ出現。
  silver_fox: {
    id:'silver_fox', name:'ぎんいろギツネ', type:'speed', art:'silver_fox',
    isRare: true,
    hp:26, atk:10, def:26, spd:23, exp:300, gold:240,
    drops: [{ id:'mat_crystal', chance:0.7 }, { id:'mat_gold', chance:0.35 }, { id:'mat_star', chance:0.12 }],
  },
  // ダンジョンボス（氷の塔さいじょうかい）：アイス・ゴーレム。2形態。
  //   倒すと flags.boss_ice → 最上階おくの宝箱（フロストメイル）が ひらく。
  ice_golem: {
    id:'ice_golem', name:'アイス・ゴーレム', type:'power', art:'ice_golem',
    isBoss: true,
    hp:260, atk:25, def:22, spd:8, exp:360, gold:300,
    drops: [{ id:'mat_gold', chance:1.0 }, { id:'mat_crystal', chance:0.8 }, { id:'mat_star', chance:0.5 }],
    phases: [
      { atk:25, def:22, spd:8 },
      { hpRatio:0.5, atk:33, def:25, spd:11 },
    ],
    quotes: {
      intro: ['「こおりの とうに\nたちいる ものは だれだ！」'],
      phase: '「こおりづけに\nしてやる！」',
      defeat: '「とけて いく…\nこおりに もどる ときが きた…」',
    },
  },

  // ══════════════════════════════════════════════════════════════════════
  //  第2章「よみがえりし やみ」（追加弾5-A/E）の てきたち。
  //   art は既存 ENEMY_ART のキーを流用（新規アートは増やさない）。
  //   ザコ→中ボス(dark_general)→新ラスボス(neo_kaiser・3形態)の順に強くなる。
  // ══════════════════════════════════════════════════════════════════════
  dark_soldier: {
    id:'dark_soldier', name:'やみの へいし', type:'power', art:'redcard_devil',
    hp:54, atk:21, def:11, spd:9, exp:42, gold:30,
    drops: [{ id:'mat_silver', chance:0.4 }, { id:'mat_crystal', chance:0.14 }],
  },
  night_raider: {
    id:'night_raider', name:'よるの レイダー', type:'speed', art:'trick_fox',
    hp:48, atk:23, def:8, spd:18, exp:46, gold:34,
    drops: [{ id:'mat_silver', chance:0.4 }, { id:'mat_crystal', chance:0.16 }],
  },
  curse_wisp: {
    id:'curse_wisp', name:'のろいの ひとだま', type:'technique', art:'losstime_ghost',
    hp:50, atk:22, def:9, spd:13, exp:44, gold:32,
    drops: [{ id:'mat_silver', chance:0.4 }, { id:'mat_crystal', chance:0.16 }],
  },
  frost_keeper: {
    id:'frost_keeper', name:'こおりの キーパー', type:'power', art:'throwin_golem',
    hp:82, atk:18, def:23, spd:5, exp:58, gold:42,
    drops: [{ id:'mat_iron', chance:0.5 }, { id:'mat_silver', chance:0.3 }, { id:'mat_crystal', chance:0.2 }],
  },
  shadow_beast: {
    id:'shadow_beast', name:'かげの けもの', type:'power', art:'stamina_zombie',
    hp:72, atk:27, def:12, spd:10, exp:62, gold:46,
    drops: [{ id:'mat_silver', chance:0.42 }, { id:'mat_crystal', chance:0.22 }],
  },
  // レアモンスター（第2章）：超高報酬・高防御・低HP。低確率で1体だけ出現。
  chaos_orb: {
    id:'chaos_orb', name:'カオスオーブ', type:'technique', art:'golden_ball',
    isRare: true,
    hp:20, atk:8, def:30, spd:24, exp:320, gold:260,
    drops: [{ id:'mat_crystal', chance:0.7 }, { id:'mat_gold', chance:0.4 }, { id:'mat_star', chance:0.15 }],
  },
  // 中ボス（こおりの とうげ）：やみの しょうぐん ヴォルク。2形態。
  dark_general: {
    id:'dark_general', name:'やみの しょうぐん ヴォルク', type:'power', art:'guardian',
    isBoss: true,
    hp:230, atk:26, def:16, spd:11, exp:450, gold:400,
    drops: [{ id:'mat_gold', chance:1.0 }, { id:'mat_crystal', chance:1.0 }, { id:'mat_star', chance:0.6 }],
    phases: [
      { atk:26, def:16, spd:11 },
      { hpRatio:0.5, atk:32, def:19, spd:14 },
    ],
    quotes: {
      intro: ['「やみの ぐんだんは\nだれにも とめられぬ！」'],
      phase: '「ぐぬ… やるな。\nだが まだ おわらん！」',
      defeat: '「ばかな… やみの しょうぐんが\nやぶれるとは…」',
    },
  },
  // 新ラスボス（やみのしろ）：ネオ・カイザー。3形態・全ボス中 最強。
  //   art は常に「怒り形態」の絵(dark_kaiser_rage)を使う。
  //   倒すと flags.boss_neo_kaiser → 第2章エンディング。
  neo_kaiser: {
    id:'neo_kaiser', name:'ネオ・カイザー', type:'technique', art:'dark_kaiser_rage',
    isBoss: true,
    hp:380, atk:28, def:18, spd:13, exp:600, gold:800,
    drops: [{ id:'mat_gold', chance:1.0 }, { id:'mat_crystal', chance:1.0 }, { id:'mat_star', chance:1.0 }],
    phases: [
      { atk:28, def:18, spd:13 },
      { hpRatio:0.66, atk:36, def:20, spd:16 },
      { hpRatio:0.33, atk:44, def:24, spd:20 },
    ],
    // phases（配列）＝2回の形態移行ごとの一言（_applyPhaseIfNeeded がN形態対応で使う）。
    quotes: {
      intro: ['「よくぞ ここまで…\nだが やみは ふめつだ！」'],
      phases: [
        '「おもしろい！\nやみの ちからを みせよう！」',
        '「ぐぬぬ… ならば\nすべてを かけて たたかう！」',
      ],
      defeat: '「これが… ひかりの ちから…\nもう やみは よみがえらぬ…」',
    },
  },

  // ════════════════════════════════════════════════════════
  // Phase7-⑤「もりの しんでん」：森の神殿に出る敵たち。
  //   本線の こおりの とう → もりの しんでん の順なので、
  //   こおりの とう雑魚より ひとまわり 強い数値にしてある。
  // ════════════════════════════════════════════════════════
  // 雑魚①（パワー）：こけの ゴーレム。HP高め・足おそい・かたい。
  moss_golem: {
    id:'moss_golem', name:'こけの ゴーレム', type:'power', art:'moss_golem',
    hp:96, atk:28, def:18, spd:6, exp:78, gold:56,
    drops: [{ id:'mat_silver', chance:0.5 }, { id:'mat_crystal', chance:0.2 }],
  },
  // 雑魚②（スピード）：もりの カラス。すばやい・HP低め。
  forest_crow: {
    id:'forest_crow', name:'もりの カラス', type:'speed', art:'forest_crow',
    hp:60, atk:27, def:10, spd:21, exp:60, gold:44,
    drops: [{ id:'mat_silver', chance:0.42 }, { id:'mat_crystal', chance:0.18 }],
  },
  // 雑魚③（テクニック）：いばらの ゴブリン。バランス型。
  thorn_goblin: {
    id:'thorn_goblin', name:'いばらの ゴブリン', type:'technique', art:'thorn_goblin',
    hp:66, atk:26, def:12, spd:15, exp:64, gold:48,
    drops: [{ id:'mat_silver', chance:0.45 }, { id:'mat_crystal', chance:0.22 }],
  },
  // レアモンスター（もりの しんでん）：エメラルドの しか。超高報酬・高防御・低HP・足はやい。
  emerald_deer: {
    id:'emerald_deer', name:'エメラルドの しか', type:'speed', art:'emerald_deer',
    isRare: true,
    hp:28, atk:11, def:28, spd:24, exp:340, gold:280,
    drops: [{ id:'mat_crystal', chance:0.7 }, { id:'mat_gold', chance:0.4 }, { id:'mat_star', chance:0.18 }],
  },
  // ボス（もりの しんでん 最上階）：森の守り神 ガイア。2形態。
  //   倒すと flags.boss_forest → 闇の城ラスボスへの道がひらく。
  forest_guardian: {
    id:'forest_guardian', name:'もりの まもりがみ ガイア', type:'power', art:'forest_guardian',
    isBoss: true,
    hp:310, atk:27, def:24, spd:10, exp:520, gold:480,
    drops: [{ id:'mat_gold', chance:1.0 }, { id:'mat_crystal', chance:1.0 }, { id:'mat_star', chance:0.7 }],
    phases: [
      { atk:27, def:24, spd:10 },
      { hpRatio:0.5, atk:34, def:27, spd:13 },
    ],
    quotes: {
      intro: ['「もりに ふみこむ ものよ…\nそのちからを ためさせて もらう！」'],
      phase: '「ほう… なかなか やるな。\nならば 森の いかりを みせよう！」',
      defeat: '「みごとだ… きみたちなら\nもりを まかせられる…」',
    },
  },

  // ════════════════════════════════════════════════════════
  // Phase7-⑥「みずの どうくつ」：地底湖のダンジョンに出る敵たち（任意ダンジョン）。
  //   art は既存 ENEMY_ART のキーを流用＝新規アートは増やさない。
  //   森の しんでん と おなじ強さ帯（任意ダンジョンなので 寄り道しても 損しない）。
  //   ザコ3体（power/speed/technique）＋レア（pearl_turtle）＋ボス（aqua_golem・2形態）。
  // ════════════════════════════════════════════════════════
  // 雑魚①（パワー）：みずの スライム。HP高め・かたい・足おそい。
  aqua_slime: {
    id:'aqua_slime', name:'みずの スライム', type:'power', art:'mud_slime',
    hp:90, atk:27, def:16, spd:7, exp:74, gold:54,
    drops: [{ id:'mat_silver', chance:0.5 }, { id:'mat_crystal', chance:0.2 }],
  },
  // 雑魚②（スピード）：しおの きつね。すばやい・HP低め。
  tide_fox: {
    id:'tide_fox', name:'しおの きつね', type:'speed', art:'trick_fox',
    hp:58, atk:26, def:10, spd:20, exp:58, gold:44,
    drops: [{ id:'mat_silver', chance:0.42 }, { id:'mat_crystal', chance:0.18 }],
  },
  // 雑魚③（テクニック）：うずの ひとだま。バランス型。
  whirl_wisp: {
    id:'whirl_wisp', name:'うずの ひとだま', type:'technique', art:'losstime_ghost',
    hp:62, atk:25, def:11, spd:14, exp:60, gold:46,
    drops: [{ id:'mat_silver', chance:0.45 }, { id:'mat_crystal', chance:0.22 }],
  },
  // レアモンスター（みずの どうくつ）：しんじゅの カメ。超高報酬・高防御・低HP。
  pearl_turtle: {
    id:'pearl_turtle', name:'しんじゅの カメ', type:'power', art:'metal_keeper',
    isRare: true,
    hp:32, atk:11, def:30, spd:18, exp:330, gold:270,
    drops: [{ id:'mat_crystal', chance:0.7 }, { id:'mat_gold', chance:0.4 }, { id:'mat_star', chance:0.16 }],
  },
  // ボス（みずの どうくつ 最下層）：アクア・ゴーレム。2形態。
  //   art は throwin_golem（ゴーレム体型の絵）を流用。
  //   倒すと flags.boss_water → 最下層おくの宝箱（さんごの よろい）が ひらく。
  aqua_golem: {
    id:'aqua_golem', name:'アクア・ゴーレム', type:'power', art:'throwin_golem',
    isBoss: true,
    hp:270, atk:26, def:23, spd:8, exp:420, gold:360,
    drops: [{ id:'mat_gold', chance:1.0 }, { id:'mat_crystal', chance:0.8 }, { id:'mat_star', chance:0.5 }],
    phases: [
      { atk:26, def:23, spd:8 },
      { hpRatio:0.5, atk:34, def:26, spd:11 },
    ],
    quotes: {
      intro: ['「ちていこの しずけさを\nやぶる ものは だれだ！」'],
      phase: '「みずの いかりを\nおもいしれ！」',
      defeat: '「しずまる… また\nみずの そこへ かえろう…」',
    },
  },

  // === 第3章 S1：せかいたいかい ===
  rival_ace: {
    id: 'rival_ace', name: 'ライバルこくの エース', type: 'speed', art: 'rival_ace',
    hp: 90, atk: 22, def: 12, spd: 16, exp: 120, gold: 90,
    appears: [20, 40],
    drops: [{ id: 'mat_gold', chance: 0.5 }],
  },
  volg: {
    id: 'volg', name: 'れっかの ヴォルグ', type: 'power', art: 'volg', isBoss: true,
    hp: 320, atk: 26, def: 16, spd: 18, exp: 700, gold: 600,
    drops: [{ id: 'mat_gold', chance: 1.0 }, { id: 'mat_crystal', chance: 1.0 }],
    quotes: {
      intro: ['「せかいの かべは あつい…\nおれを こえて みせろ！」'],
      defeat: '「みごとだ… きみたちが\nせかいいちだ。だが そらを みろ！」',
    },
  },

  // === 第3章 S2：うちゅうせん ネビュラごう ===
  mecha_soldier: {
    id: 'mecha_soldier', name: 'メカ・ソルジャー', type: 'power', art: 'mecha_soldier',
    hp: 110, atk: 24, def: 16, spd: 12, exp: 150, gold: 110,
    appears: [30, 50],
    drops: [{ id: 'mat_iron', chance: 0.6 }, { id: 'mat_crystal', chance: 0.3 }],
  },
  mecha_drone: {
    id: 'mecha_drone', name: 'メカ・ドローン', type: 'speed', art: 'mecha_drone',
    hp: 80, atk: 20, def: 10, spd: 22, exp: 130, gold: 90,
    appears: [30, 50],
    drops: [{ id: 'mat_iron', chance: 0.5 }],
  },
  zeros: {
    id: 'zeros', name: 'メカ・エンペラー ゼロス', type: 'technique', art: 'zeros', isBoss: true,
    hp: 450, atk: 30, def: 22, spd: 16, exp: 1000, gold: 900,
    drops: [{ id: 'mat_gold', chance: 1.0 }, { id: 'mat_crystal', chance: 1.0 }, { id: 'mat_star', chance: 1.0 }],
    phases: [
      { atk: 30, def: 22, spd: 16 },
      { hpRatio: 0.6, atk: 36, def: 24, spd: 19 },
      { hpRatio: 0.3, atk: 42, def: 28, spd: 22 },
    ],
    quotes: {
      intro: ['「ちきゅうの サッカーは\nわれわれ きかいが せいはする！」'],
      phases: ['「システム、フルパワー!!」', '「ありえない… にんげんに\nまけるなど…!!」'],
      defeat: '「なぜだ… なぜ きかいが\nこころに まけるのだ…」',
    },
  },
  star_sentinel: {
    id: 'star_sentinel', name: 'せいしんの まもりて', type: 'technique', art: 'star_sentinel',
    hp: 140, atk: 28, def: 20, spd: 18, exp: 220, gold: 150,
    appears: [40, 60], drops: [{ id: 'mat_star', chance: 0.4 }, { id: 'mat_crystal', chance: 0.4 }],
  },
  asterion: {
    id: 'asterion', name: 'ほしくいの かみ アステリオン', type: 'technique', art: 'asterion', isBoss: true,
    hp: 560, atk: 34, def: 26, spd: 20, exp: 2000, gold: 1500,
    drops: [{ id: 'mat_gold', chance: 1.0 }, { id: 'mat_star', chance: 1.0 }],
    phases: [
      { atk: 34, def: 26, spd: 20 },
      { hpRatio: 0.66, atk: 40, def: 28, spd: 24 },
      { hpRatio: 0.33, atk: 48, def: 32, spd: 28 },
    ],
    quotes: {
      intro: ['「おうごんの ボールは\nわが ほしの たから。\nにんげんには わたさぬ！」'],
      phases: ['「ほしの ちからを\nみせてやろう！」', '「なぜ… にんげんの きずなが\nこれほど つよいのだ!?」'],
      defeat: '「わかった…\nこの ボールは、みなを\nつなぐ ための ものだったのだな。」',
    },
  },
};

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { ENEMIES });
