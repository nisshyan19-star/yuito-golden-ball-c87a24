const ENEMIES = {
  foul_goblin: {
    id:'foul_goblin', name:'ファウルゴブリン',
    hp:14, atk:6, def:2, spd:5, exp:4, gold:3,
    appears: [1, 2],
  },
  offside_ghost: {
    id:'offside_ghost', name:'オフサイドおばけ',
    hp:18, atk:8, def:3, spd:11, exp:7, gold:5,
    appears: [2, 3],
  },
  hand_monster: {
    id:'hand_monster', name:'ハンドモンスター',
    hp:26, atk:9, def:8, spd:4, exp:10, gold:8,
    appears: [3, 4],
  },
  yellowcard_bat: {
    id:'yellowcard_bat', name:'イエローカードコウモリ',
    hp:22, atk:10, def:4, spd:12, exp:12, gold:9,
    appears: [4, 5],
    skills: ['stun_bite'],
  },
  redcard_devil: {
    id:'redcard_devil', name:'レッドカードデビル',
    hp:34, atk:14, def:6, spd:9, exp:18, gold:14,
    appears: [5],
  },
  guardian: {
    id:'guardian', name:'鉄壁キーパー ガーディアン',
    isBoss: true,
    hp:120, atk:12, def:18, spd:4, exp:60, gold:80,
  },
  dark_kaiser: {
    id:'dark_kaiser', name:'ダーク・カイザー',
    isBoss: true,
    hp:160, atk:16, def:10, spd:8, exp:200, gold:300,
    phases: [
      { atk:16, def:10, spd:8 },
      { hpRatio:0.5, atk:22, def:12, spd:11 },
    ],
  },
};

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { ENEMIES });
