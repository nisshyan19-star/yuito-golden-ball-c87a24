const ITEMS = {
  drink:           { id:'drink',           name:'スポーツドリンク',       kind:'item',   effect:{ hp:30 },        price:20  },
  jelly:           { id:'jelly',           name:'エナジーゼリー',         kind:'item',   effect:{ mp:20 },        price:30  },
  firstaid:        { id:'firstaid',        name:'救急バッグ',             kind:'item',   effect:{ hp:120 },       price:80  },
  restart_whistle: { id:'restart_whistle', name:'リスタートの笛',         kind:'item',   effect:{ revive:0.5 },   price:120 },
  spike1:          { id:'spike1',          name:'トレーニングシューズ',   kind:'weapon', atk:3,                   price:60  },
  spike2:          { id:'spike2',          name:'スピードスパイク',       kind:'weapon', atk:7,                   price:200 },
  spike3:          { id:'spike3',          name:'ゴールデンスパイク',     kind:'weapon', atk:14,                  price:600 },
  uni1:            { id:'uni1',            name:'れんしゅうユニフォーム', kind:'armor',  def:3,                   price:60  },
  uni2:            { id:'uni2',            name:'チームユニフォーム',     kind:'armor',  def:7,                   price:200 },
  uni3:            { id:'uni3',            name:'おうごんユニフォーム',   kind:'armor',  def:14,                  price:600 },
};

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { ITEMS });
