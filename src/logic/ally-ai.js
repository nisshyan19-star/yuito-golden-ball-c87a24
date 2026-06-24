const SKILLS = (typeof require !== 'undefined')
  ? require('../data/skills.js').SKILLS
  : (typeof window !== 'undefined' && window.SRPG && window.SRPG.SKILLS);

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
  const mySkills = actor.skills.map(id => SKILLS[id]).filter(Boolean);

  function canUse(s) {
    return s && actor.mp >= s.mp;
  }

  // 1. 回復役（heal技を所持）
  const healSkills = mySkills.filter(s => s.type === 'heal');
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

  // 3. 全体攻撃 & 敵2体以上
  const aoeAttack = mySkills.find(s => s.type === 'attack' && s.target === 'all' && canUse(s));
  if (aoeAttack && aliveEnemies.length >= 2) {
    return { type: 'skill', skillId: aoeAttack.id };
  }

  // 4. 単体必殺技（power高い順） & MP足りる
  const oneAttacks = mySkills
    .filter(s => s.type === 'attack' && s.target === 'one' && canUse(s))
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
