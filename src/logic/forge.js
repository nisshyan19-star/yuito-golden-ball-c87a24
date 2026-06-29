// src/logic/forge.js
// 鍛冶屋・装備合成・素材ドロップ ロジック（追加弾5-D）
// トップレベルには function 宣言のみ（const/let 禁止＝バンドルスコープ衝突回避）。
// データ（レシピ）は forgeRecipes() が関数内で配列を生成して返す。

// ── データ遅延解決（monster.js の _monster() と同じ書き方） ──────────────
//   Node: require でモジュールから取得。ブラウザ: window.SRPG から取得。
function _items() {
  if (typeof require !== 'undefined') return require('../data/items.js').ITEMS;
  return (typeof window !== 'undefined' && window.SRPG && window.SRPG.ITEMS) || {};
}

// 合成レシピ一覧を返す（const を置かないため毎回 new 配列で返す）。
//   各レシピ { id, result:<itemId>, materials:[{id,qty}], gold }。
function forgeRecipes() {
  return [
    { id: 'r_blade',  result: 'forged_blade',  materials: [{ id: 'mat_iron', qty: 3 }, { id: 'mat_leather', qty: 2 }], gold: 50 },
    { id: 'r_guard',  result: 'forged_guard',  materials: [{ id: 'mat_leather', qty: 4 }, { id: 'mat_iron', qty: 2 }], gold: 50 },
    { id: 'r_mspike', result: 'mithril_spike', materials: [{ id: 'mat_silver', qty: 3 }, { id: 'mat_crystal', qty: 1 }, { id: 'mat_iron', qty: 4 }], gold: 200 },
    { id: 'r_marmor', result: 'mithril_armor', materials: [{ id: 'mat_silver', qty: 3 }, { id: 'mat_crystal', qty: 1 }, { id: 'mat_leather', qty: 4 }], gold: 200 },
    { id: 'r_sboots', result: 'star_boots',    materials: [{ id: 'mat_gold', qty: 2 }, { id: 'mat_star', qty: 1 }, { id: 'mat_crystal', qty: 3 }], gold: 800 },
    { id: 'r_smail',  result: 'star_mail',     materials: [{ id: 'mat_gold', qty: 2 }, { id: 'mat_star', qty: 1 }, { id: 'mat_crystal', qty: 3 }], gold: 800 },
  ];
}

// 敵の drops を抽選し、当たった素材 id の配列を返す。
//   d.chance==null は 1（確定）扱い。rng が無ければ chance>=1 のものだけ落ちる。
function rollDrops(enemy, rng) {
  if (!enemy || !enemy.drops || !enemy.drops.length) return [];
  var out = [];
  for (var i = 0; i < enemy.drops.length; i++) {
    var d = enemy.drops[i];
    if (!d || !d.id) continue;
    var ch = (d.chance == null) ? 1 : d.chance;
    var hit;
    if (rng && typeof rng.chance === 'function') hit = rng.chance(ch);
    else hit = (ch >= 1);
    if (hit) out.push(d.id);
  }
  return out;
}

// id 一致のレシピを返す（無ければ null）。
function _recipe(id) {
  var list = forgeRecipes();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i];
  }
  return null;
}

// 合成できるか判定する。{ ok:boolean, reason? }。
//   reason: 'norecipe'（レシピ無）/ 'material'（素材不足）/ 'gold'（金不足）。
function canForge(state, recipeId) {
  var recipe = _recipe(recipeId);
  if (!recipe) return { ok: false, reason: 'norecipe' };
  var inv = (state && state.inventory) || {};
  for (var i = 0; i < recipe.materials.length; i++) {
    var mat = recipe.materials[i];
    if ((inv[mat.id] || 0) < mat.qty) return { ok: false, reason: 'material' };
  }
  if (((state && state.gold) || 0) < (recipe.gold || 0)) return { ok: false, reason: 'gold' };
  return { ok: true };
}

// 合成を実行する。canForge が ok でなければ それを返す。
//   ok なら 素材と金を減らし、result を inventory に +1 して { ok:true, result } を返す。
function doForge(state, recipeId) {
  var chk = canForge(state, recipeId);
  if (!chk.ok) return chk;
  var recipe = _recipe(recipeId);
  if (!state.inventory) state.inventory = {};
  var inv = state.inventory;
  for (var i = 0; i < recipe.materials.length; i++) {
    var mat = recipe.materials[i];
    inv[mat.id] = (inv[mat.id] || 0) - mat.qty;
    if (inv[mat.id] <= 0) delete inv[mat.id];
  }
  state.gold = ((state.gold) || 0) - (recipe.gold || 0);
  inv[recipe.result] = (inv[recipe.result] || 0) + 1;
  return { ok: true, result: recipe.result };
}

// ── UMD エクスポート ──────────────────────────────────────────────────
(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  forgeRecipes: forgeRecipes,
  rollDrops:    rollDrops,
  canForge:     canForge,
  doForge:      doForge,
});
