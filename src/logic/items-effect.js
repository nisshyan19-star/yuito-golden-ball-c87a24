// ITEMS は data/items.js で定義済み。単一バンドル時に同名 const が衝突して
// スクリプト全体がパース失敗する（black screen）のを避けるため、トップレベルで
// const キャプチャせず、game-state.js の _characters() と同じく遅延解決する。
function _items() {
  if (typeof require !== 'undefined') return require('../data/items.js').ITEMS;
  return (typeof window !== 'undefined' && window.SRPG && window.SRPG.ITEMS) || {};
}

/**
 * useItem(target, item)
 * 道具を target に使い効果をその場で適用する。
 * @returns {{ ok: boolean, message: string }}
 */
function useItem(target, item) {
  const eff = item.effect || {};
  let applied = false;

  // 復活アイテム
  if ('revive' in eff) {
    if (!target.dead) {
      return { ok: false, message: 'まだ たおれていない' };
    }
    target.dead = false;
    target.hp = Math.max(1, Math.floor(target.maxHp * eff.revive));
    return { ok: true, message: 'たちあがった！' };
  }

  // HP / MP 回復（戦闘不能には使えない）
  if ('hp' in eff || 'mp' in eff) {
    if (target.dead) {
      return { ok: false, message: 'たおれていて つかえない' };
    }
    if ('hp' in eff) {
      target.hp = Math.min(target.maxHp, target.hp + eff.hp);
      applied = true;
    }
    if ('mp' in eff) {
      target.mp = Math.min(target.maxMp, target.mp + eff.mp);
      applied = true;
    }
    if (applied) {
      // HP と MP 両方持つ場合も含め、どちらか効けば ok:true
      if ('hp' in eff && !('mp' in eff)) {
        return { ok: true, message: 'HPが かいふくした！' };
      }
      if ('mp' in eff && !('hp' in eff)) {
        return { ok: true, message: 'スタミナが かいふくした！' };
      }
      // 両方
      return { ok: true, message: 'HPが かいふくした！' };
    }
  }

  return { ok: false, message: 'なにも おきなかった' };
}

/**
 * healParty(party)
 * 宿屋用：パーティ全員の HP/MP を全回復し、戦闘不能も復活させる（破壊的）。
 * @param {Array} party state.party
 * @returns {number} 回復した（生存させた）人数
 */
function healParty(party) {
  var n = 0;
  (party || []).forEach(function (c) {
    if (!c) return;
    c.dead = false;
    if (typeof c.maxHp === 'number') c.hp = c.maxHp;
    if (typeof c.maxMp === 'number') c.mp = c.maxMp;
    n++;
  });
  return n;
}

/**
 * applyEquip(character)
 * 装備の atk/def を反映した実効値を返す（非破壊）。
 * @returns {{ atk: number, def: number }}
 */
function applyEquip(character) {
  const weaponId = character.equip && character.equip.weapon;
  const armorId  = character.equip && character.equip.armor;

  const ITEMS = _items();
  const weaponAtk = (weaponId && ITEMS && ITEMS[weaponId]) ? ITEMS[weaponId].atk : 0;
  const armorDef  = (armorId  && ITEMS && ITEMS[armorId])  ? ITEMS[armorId].def  : 0;

  return {
    atk: character.atk + (weaponAtk || 0),
    def: character.def + (armorDef  || 0),
  };
}

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { useItem, applyEquip, healParty });
