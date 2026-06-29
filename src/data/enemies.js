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
};

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { ENEMIES });
