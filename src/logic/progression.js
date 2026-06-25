// SKILLS は data/skills.js で定義済み。単一バンドル時に同名 const が衝突して
// スクリプト全体がパース失敗する（black screen）のを避けるため、トップレベルで
// const キャプチャせず、game-state.js の _characters() と同じく遅延解決する。
function _skills() {
  if (typeof require !== 'undefined') return require('../data/skills.js').SKILLS;
  return (typeof window !== 'undefined' && window.SRPG && window.SRPG.SKILLS) || {};
}

/**
 * 次のレベルに必要な経験値
 * @param {number} level
 * @returns {number}
 */
function expForNextLevel(level) {
  return Math.floor(8 * Math.pow(level, 1.6)) + level * 4;
}

/**
 * 経験値を加算し、レベルアップ・能力上昇・技習得を適用する
 * @param {object} character - キャラクターオブジェクト（直接書き換える）
 * @param {number} amount - 加算する経験値
 * @returns {{ leveledUp: boolean, learned: string[] }}
 */
function gainExp(character, amount) {
  let leveledUp = false;
  const learned = [];

  character.exp += amount;

  while (character.exp >= expForNextLevel(character.level)) {
    character.exp -= expForNextLevel(character.level);
    character.level += 1;
    character.maxHp  += character.growth.hp;
    character.maxMp  += character.growth.mp;
    character.atk    += character.growth.atk;
    character.def    += character.growth.def;
    character.spd    += character.growth.spd;
    // レベルアップ時全回復
    character.hp = character.maxHp;
    character.mp = character.maxMp;
    leveledUp = true;
  }

  // 技習得判定（レベルアップが1回でも発生した場合）
  if (leveledUp) {
    for (const skill of Object.values(_skills())) {
      if (
        skill.user === character.id &&
        skill.learnLevel != null &&
        skill.learnLevel <= character.level &&
        !character.skills.includes(skill.id)
      ) {
        character.skills.push(skill.id);
        learned.push(skill.id);
      }
    }
  }

  return { leveledUp, learned };
}

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { expForNextLevel, gainExp });
