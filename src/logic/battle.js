/**
 * battle.js — 戦闘ダメージ計算コア
 * calcDamage / applyDamage / isDefeated
 */

/**
 * タイプ相性（サッカー版・3すくみ）の倍率を返す。
 *   パワー → テクニック → スピード → パワー （矢印の先に「強い」）
 * 有利=1.5倍 / 不利=0.75倍 / それ以外=1.0倍。
 * @param {string} atkType - 攻撃側のタイプ('power'|'technique'|'speed')
 * @param {string} defType - 防御側のタイプ
 * @returns {number} ダメージ倍率
 */
function typeMultiplier(atkType, defType) {
  var chart = {
    power:     { strong: 'technique', weak: 'speed'     },
    technique: { strong: 'speed',     weak: 'power'     },
    speed:     { strong: 'power',     weak: 'technique' },
  };
  var c = chart[atkType];
  if (!c || !defType) return 1;
  if (defType === c.strong) return 1.5;
  if (defType === c.weak)   return 0.75;
  return 1;
}

/**
 * ダメージを計算して返す。
 * @param {{ atk: number }} attacker
 * @param {{ def: number }} defender
 * @param {{ power?: number, rng?: object, crit?: boolean, typeMul?: number }} [opts]
 * @returns {number} ダメージ値（1以上）
 */
function calcDamage(attacker, defender, opts) {
  var power   = (opts && opts.power != null) ? opts.power : 1;
  var rng     = (opts && opts.rng)  ? opts.rng  : null;
  var critOpt = (opts && opts.crit != null) ? opts.crit : null;
  var typeMul = (opts && opts.typeMul != null) ? opts.typeMul : 1; // タイプ相性倍率（既定1.0）

  var base = attacker.atk - defender.def / 2;

  // 乱数の呼び出し順序を固定: 先に variance、次に crit
  var variance = (rng != null) ? (0.9 + 0.2 * rng.next()) : 0.5 + 0.9; // rng無し→中央値1.0相当
  // ※ rng無しの場合 variance = 0.9 + 0.2 * 0.5 = 1.0（中央値）
  if (rng == null) {
    variance = 0.9 + 0.2 * 0.5; // 1.0
  }

  var dmg = Math.max(1, Math.round(base * power * variance * typeMul));

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

/**
 * PK戦（追加弾3・ミニゲーム）の1本を判定する純粋関数。
 *   シュート方向とキーパーの飛ぶ方向が違えば「ゴール」、同じなら「セーブ」。
 *   方向は 'left' | 'center' | 'right'。
 * @param {string} shoot  - シュート方向
 * @param {string} keeper - キーパーが飛ぶ方向
 * @returns {boolean} ゴールなら true、セーブされたら false
 */
function pkResolve(shoot, keeper) {
  return shoot !== keeper;
}

// COMBOS は遅延解決する（skills.js の読み込み順に依存しないように、呼ばれた時点で参照）。
function _resolveCombos() {
  if (typeof require !== 'undefined') {
    try { return require('../data/skills.js').COMBOS || {}; } catch (e) { /* ブラウザ */ }
  }
  return (typeof window !== 'undefined' && window.SRPG && window.SRPG.COMBOS) || {};
}

/**
 * いま発動できる連携技（追加弾4-B）の一覧を返す純粋関数。
 *   発動条件：コンビの members 全員が「生きている（dead でなく hp>0）」かつ
 *   「キアイがMAX（kiai >= maxKiai、未設定は100扱い）」であること。
 * @param {Array<{id:string,kiai?:number,maxKiai?:number,hp?:number,dead?:boolean}>} party - 戦闘中の味方配列
 * @returns {Array<object>} 発動可能なコンビ定義の配列（条件未達なら空配列）
 */
function availableCombos(party) {
  var COMBOS = _resolveCombos();
  var byId = {};
  (party || []).forEach(function (p) {
    if (p && !(p.dead === true || (p.hp != null && p.hp <= 0))) byId[p.id] = p;
  });
  var out = [];
  for (var id in COMBOS) {
    if (!Object.prototype.hasOwnProperty.call(COMBOS, id)) continue;
    var c = COMBOS[id];
    if (!c || !Array.isArray(c.members)) continue;
    var ok = c.members.every(function (m) {
      var u = byId[m];
      return !!u && (u.kiai || 0) >= (u.maxKiai || 100);
    });
    if (ok) out.push(c);
  }
  return out;
}

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { calcDamage, applyDamage, isDefeated, typeMultiplier, pkResolve, availableCombos });
