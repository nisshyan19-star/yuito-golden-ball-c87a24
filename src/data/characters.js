const CHARACTERS = {
  yuito: {
    id:'yuito', name:'ユイト', position:'エース(FW)',
    base:   { hp:32, mp:12, atk:10, def:7,  spd:9  },
    growth: { hp:6,  mp:3,  atk:2,  def:1,  spd:1  },
    skills: ['drive_shoot'],
    joinChapter: 0,
  },
  ikuma: {
    id:'ikuma', name:'イクマ', position:'ストライカー(FW)',
    base:   { hp:30, mp:8,  atk:12, def:5,  spd:8  },
    growth: { hp:6,  mp:2,  atk:3,  def:1,  spd:1  },
    skills: ['header'],
    joinChapter: 1,
  },
  aoshi: {
    id:'aoshi', name:'アオシ', position:'司令塔(MF)',
    base:   { hp:26, mp:16, atk:8,  def:6,  spd:10 },
    growth: { hp:5,  mp:4,  atk:1,  def:1,  spd:2  },
    skills: ['razor_pass'],
    joinChapter: 2,
  },
  tomoki: {
    id:'tomoki', name:'トモキ', position:'守りの要(DF)',
    base:   { hp:38, mp:6,  atk:7,  def:10, spd:5  },
    growth: { hp:8,  mp:1,  atk:1,  def:3,  spd:1  },
    skills: ['tackle', 'guard'],
    joinChapter: 3,
  },
  itsuki: {
    id:'itsuki', name:'イツキ', position:'守護神(GK)',
    base:   { hp:28, mp:18, atk:6,  def:8,  spd:7  },
    growth: { hp:5,  mp:4,  atk:1,  def:2,  spd:1  },
    skills: ['super_save'],
    joinChapter: 4,
  },
};

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { CHARACTERS });
