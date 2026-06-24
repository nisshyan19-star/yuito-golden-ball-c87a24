/**
 * battle.js — 戦闘ダメージ計算コア
 * calcDamage / applyDamage / isDefeated
 */

/**
 * ダメージを計算して返す。
 * @param {{ atk: number }} attacker
 * @param {{ def: number }} defender
 * @param {{ power?: number, rng?: object, crit?: boolean }} [opts]
 * @returns {number} ダメージ値（1以上）
 */
function calcDamage(attacker, defender, opts) {
  var power   = (opts && opts.power != null) ? opts.power : 1;
  var rng     = (opts && opts.rng)  ? opts.rng  : null;
  var critOpt = (opts && opts.crit != null) ? opts.crit : null;

  var base = attacker.atk - defender.def / 2;

  // 乱数の呼び出し順序を固定: 先に variance、次に crit
  var variance = (rng != null) ? (0.9 + 0.2 * rng.next()) : 0.5 + 0.9; // rng無し→中央値1.0相当
  // ※ rng無しの場合 variance = 0.9 + 0.2 * 0.5 = 1.0（中央値）
  if (rng == null) {
    variance = 0.9 + 0.2 * 0.5; // 1.0
  }

  var dmg = Math.max(1, Math.round(base * power * variance));

  // クリティカル判定（乱数呼び出し順: varianceの後）
  var isCrit;
  if (critOpt !== null && critOpt !== undefined) {
    isCrit = !!critOpt;
  } else if (rng != null) {
    isCrit = rng.chance(0.08);
  } else {
    isCrit = false;
  }

  if (isCrit) {
    dmg = Math.max(1, dmg * 2);
  }

  return dmg;
}

/**
 * ダメージをユニットに適用する。
 * @param {{ hp: number, dead: boolean }} target
 * @param {number} dmg
 * @returns {number} 適用後の hp
 */
function applyDamage(target, dmg) {
  target.hp = Math.max(0, target.hp - dmg);
  if (target.hp === 0) {
    target.dead = true;
  }
  return target.hp;
}

/**
 * ユニットが倒されているか判定する。
 * @param {{ hp: number, dead: boolean }} unit
 * @returns {boolean}
 */
function isDefeated(unit) {
  return unit.hp <= 0 || unit.dead === true;
}

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { calcDamage, applyDamage, isDefeated });
