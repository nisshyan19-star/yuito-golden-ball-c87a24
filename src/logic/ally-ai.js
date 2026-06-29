// SKILLS は data/skills.js で定義済み。単一バンドル時に同名 const が衝突して
// スクリプト全体がパース失敗する（black screen）のを避けるため、トップレベルで
// const キャプチャせず、game-state.js の _characters() と同じく遅延解決する。
function _skills() {
  if (typeof require !== 'undefined') return require('../data/skills.js').SKILLS;
  return (typeof window !== 'undefined' && window.SRPG && window.SRPG.SKILLS) || {};
}

// ヘルパ関数
function isDead(u) {
  return u.dead === true || u.hp <= 0;
}

function ratio(u) {
  if (!u.maxHp || u.maxHp === 0) return 1;
  return u.hp / u.maxHp;
}

/**
 * おまかせAI: 仲間キャラクターの行動を決定する
 * @param {object} actor - 行動するキャラクター
 * @param {object[]} party - 味方全員（actor含む）
 * @param {object[]} enemies - 敵全員
 * @param {object} rng - 乱数生成器（シグネチャ維持用）
 * @returns {{ type:'attack'|'skill'|'cover', skillId?, targetId? }}
 */
function chooseAllyAction(actor, party, enemies, rng) {
  const aliveEnemies = enemies.filter(e => !isDead(e));
  const aliveAllies = party.filter(p => !isDead(p));
  const SKILLS = _skills();
  const mySkills = actor.skills.map(id => SKILLS[id]).filter(Boolean);

  function canUse(s) {
    return s && actor.mp >= s.mp;
  }

  // 0. 必殺技（キアイMAX時のみ）。戦闘ごとの切り札なので撃てるなら積極的に使う。
  const kiaiReady = (actor.kiai || 0) >= (actor.maxKiai || 100);
  if (kiaiReady) {
    const ults = mySkills.filter(s => s.kiai && (s.type === 'attack' || s.type === 'heal'));
    // 回復必殺：誰かが7割以下なら全体回復で撃つ
    const healUlt = ults.find(s => s.type === 'heal');
    if (healUlt && aliveAllies.some(a => ratio(a) <= 0.7)) {
      return { type: 'skill', skillId: healUlt.id };
    }
    // 攻撃必殺：敵が2体以上なら全体必殺、それ以外は単体必殺を最も硬い敵（ボス想定）へ
    const atkUlts = ults.filter(s => s.type === 'attack');
    if (atkUlts.length > 0 && aliveEnemies.length > 0) {
      const aoeUlt = atkUlts.find(s => s.target === 'all');
      if (aoeUlt && aliveEnemies.length >= 2) {
        return { type: 'skill', skillId: aoeUlt.id };
      }
      const oneUlt = atkUlts.find(s => s.target === 'one') || atkUlts[0];
      if (oneUlt) {
        if (oneUlt.target === 'all') return { type: 'skill', skillId: oneUlt.id };
        const target = aliveEnemies.reduce((a, b) => (a.hp >= b.hp ? a : b));
        return { type: 'skill', skillId: oneUlt.id, targetId: target.id };
      }
    }
    // 撃ちどころが無ければキアイは温存して通常行動へフォールスルー
  }

  // 1. 回復役（heal技を所持・必殺は除外）
  const healSkills = mySkills.filter(s => s.type === 'heal' && !s.kiai);
  if (healSkills.length > 0) {
    const dyingAllies = aliveAllies.filter(a => ratio(a) <= 0.35);

    // 瀕死が2人以上かつ全体回復が使える
    if (dyingAllies.length >= 2) {
      const aoeHeal = healSkills.find(s => s.target === 'allies' && canUse(s));
      if (aoeHeal) {
        return { type: 'skill', skillId: aoeHeal.id };
      }
    }

    // 瀕死が1人以上かつ単体回復が使える
    if (dyingAllies.length >= 1) {
      const singleHeal = healSkills.find(s => s.target === 'ally' && canUse(s));
      if (singleHeal) {
        // 最も ratio の低い瀕死味方を対象に
        const target = dyingAllies.reduce((a, b) => ratio(a) <= ratio(b) ? a : b);
        return { type: 'skill', skillId: singleHeal.id, targetId: target.id };
      }
    }
    // 瀕死がいない／MP不足なら次へフォールスルー
  }

  // 2. かばう役（cover技を所持）
  const coverSkills = mySkills.filter(s => s.type === 'cover');
  if (coverSkills.length > 0) {
    const dyingOthers = aliveAllies.filter(a => a.id !== actor.id && ratio(a) <= 0.35);
    if (dyingOthers.length > 0) {
      const coverSkill = coverSkills[0];
      const target = dyingOthers.reduce((a, b) => ratio(a) <= ratio(b) ? a : b);
      return { type: 'cover', skillId: coverSkill.id, targetId: target.id };
    }
  }

  // 3. 全体攻撃 & 敵2体以上（必殺は除外）
  const aoeAttack = mySkills.find(s => s.type === 'attack' && s.target === 'all' && !s.kiai && canUse(s));
  if (aoeAttack && aliveEnemies.length >= 2) {
    return { type: 'skill', skillId: aoeAttack.id };
  }

  // 4. 単体とくぎ（power高い順）& MP足りる（必殺は除外）
  const oneAttacks = mySkills
    .filter(s => s.type === 'attack' && s.target === 'one' && !s.kiai && canUse(s))
    .sort((a, b) => (b.power || 0) - (a.power || 0));
  if (oneAttacks.length > 0 && aliveEnemies.length > 0) {
    const best = oneAttacks[0];
    const target = aliveEnemies.reduce((a, b) => a.hp <= b.hp ? a : b);
    return { type: 'skill', skillId: best.id, targetId: target.id };
  }

  // 5. 通常攻撃：最も hp の低い生存敵を狙う
  if (aliveEnemies.length > 0) {
    const target = aliveEnemies.reduce((a, b) => a.hp <= b.hp ? a : b);
    return { type: 'attack', targetId: target.id };
  }

  // 6. 生存敵がいない保険
  return { type: 'attack', targetId: null };
}

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { chooseAllyAction });
