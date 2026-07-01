const CHARACTERS = {
  yuito: {
    id:'yuito', name:'ユイト', position:'エース(FW)', type:'power',
    base:   { hp:32, mp:12, atk:10, def:7,  spd:9  },
    growth: { hp:6,  mp:3,  atk:2,  def:1,  spd:1  },
    skills: ['drive_shoot', 'ult_yuito'],
    joinChapter: 0,
    profile: {
      age: '9さい',
      flavor: 'ゴールへ まっすぐ エースストライカー',
      bio: [
        'サッカーが せかいで いちばん だいすきな しょうねん。',
        'まけても なんども たちあがる、あきらめない こころの もちぬし。',
        'こまっている子を ほうっておけない、チームの ムードメーカー。',
      ],
      dream: 'せかいいちの ストライカーに なること',
    },
  },
  ikuma: {
    id:'ikuma', name:'イクマ', position:'ストライカー(FW)', type:'speed',
    base:   { hp:30, mp:8,  atk:12, def:5,  spd:8  },
    growth: { hp:6,  mp:2,  atk:3,  def:1,  spd:1  },
    skills: ['header', 'ult_ikuma'],
    joinChapter: 1,
    profile: {
      age: '9さい',
      flavor: 'かぜより はやい スピードスター',
      bio: [
        'あしの はやさは チームいちばん。ボールを もったら だれにも おいつけない。',
        'まけずぎらいで ねっけつ。むかしは ユイトの ライバルだった。',
        'いまは いちばんの しんゆう。ユイトの となりで ゴールを ねらう。',
      ],
      dream: 'ユイトと ツートップで かちまくること',
    },
  },
  aoshi: {
    id:'aoshi', name:'アオシ', position:'司令塔(MF)', type:'technique',
    base:   { hp:26, mp:16, atk:8,  def:6,  spd:10 },
    growth: { hp:5,  mp:4,  atk:1,  def:1,  spd:2  },
    skills: ['razor_pass', 'ult_aoshi'],
    joinChapter: 2,
    profile: {
      age: '10さい',
      flavor: 'グラウンドを よむ しれいとう',
      bio: [
        'あたまが よくて れいせい。しあいの ながれを よんで パスを くばる。',
        'ことばは すくないけど、なかまの ことを だれより かんがえている。',
        'ピンチのときほど おちついて、みんなを みちびく たよれる せんぱい。',
      ],
      dream: 'みんなで さいこうの チームを つくること',
    },
  },
  tomoki: {
    id:'tomoki', name:'トモキ', position:'守りの要(DF)', type:'power',
    base:   { hp:38, mp:6,  atk:7,  def:10, spd:5  },
    growth: { hp:8,  mp:1,  atk:1,  def:3,  spd:1  },
    skills: ['tackle', 'guard', 'ult_tomoki'],
    joinChapter: 3,
    profile: {
      age: '10さい',
      flavor: 'ぜったい とおさない てつのかべ',
      bio: [
        'からだが おおきくて、こころは やさしい まもりの せんし。',
        'なかまを まもるためなら、どんな てきにも ひるまない。',
        'ふだんは のんびりやさん。どうぶつと チビっこに 大にんき。',
      ],
      dream: 'みんなが わらえる チームを まもること',
    },
  },
  itsuki: {
    id:'itsuki', name:'イツキ', position:'守護神(GK)', type:'technique',
    base:   { hp:28, mp:18, atk:6,  def:8,  spd:7  },
    growth: { hp:5,  mp:4,  atk:1,  def:2,  spd:1  },
    skills: ['super_save', 'ult_itsuki'],
    joinChapter: 4,
    profile: {
      age: '9さい',
      flavor: 'ゴールマウスの しゅごしん',
      bio: [
        'チーム さいごの とりで、れいせいな ゴールキーパー。',
        'あいての うごきを じっと みて、ここぞで スーパーセーブを みせる。',
        'ふだんは しずかだけど、しんじた なかまには ぜったいの しんらい。',
      ],
      dream: 'ぜったいに ゴールを わらせない むてきの まもり',
    },
  },
};

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { CHARACTERS });
