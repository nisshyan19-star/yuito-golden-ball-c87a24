// src/logic/monster.js
// なかまモンスター（スカウト・パーティ管理）ロジック
// トップレベルには function 宣言のみ（const/let 禁止）

function maxParty() {
  return 5;
}

function enemyToCharacter(enemy) {
  var baseId = enemy.baseId || enemy.id;
  var name   = enemy.name;
  var type   = enemy.type;
  var maxHp  = (enemy.maxHp != null) ? enemy.maxHp : enemy.hp;
  var atk    = enemy.atk;
  var def    = enemy.def;
  var spd    = enemy.spd;
  var maxMp  = (enemy.maxMp != null) ? enemy.maxMp : 0;
  var skills = Array.isArray(enemy.skills) ? enemy.skills.slice() : [];

  var growth = {
    hp:  Math.max(1, Math.round(maxHp * 0.12)),
    mp:  Math.max(1, Math.round((maxMp || 0) * 0.1)),
    atk: Math.max(1, Math.round(atk * 0.12)),
    def: Math.max(1, Math.round(def * 0.12)),
    spd: Math.max(1, Math.round(spd * 0.1))
  };

  return {
    id:       baseId + '_mon',
    baseId:   baseId,
    name:     name,
    type:     type,
    level:    1,
    exp:      0,
    maxHp:    maxHp,
    hp:       maxHp,
    maxMp:    maxMp,
    mp:       maxMp,
    atk:      atk,
    def:      def,
    spd:      spd,
    kiai:     0,
    maxKiai:  100,
    skills:   skills,
    equip:    { weapon: null, armor: null },
    dead:     false,
    isMonster: true,
    growth:   growth
  };
}

function canScout(enemy) {
  if (enemy.isBoss === true) return false;
  return true;
}

function scoutChance(enemy) {
  if (!canScout(enemy)) return 0;
  var base    = enemy.isRare ? 0.15 : 0.5;
  var maxHp   = (enemy.maxHp != null) ? enemy.maxHp : (enemy.hp || 1);
  var hpNow   = (enemy.hp != null) ? enemy.hp : maxHp;
  var hpRatio = Math.min(1, Math.max(0, hpNow / maxHp));
  var chance  = base * (1 - 0.85 * hpRatio);
  return Math.max(0, Math.min(0.95, chance));
}

function addToRoster(state, char) {
  if (!Array.isArray(state.party)) state.party = [];
  if (state.party.length < maxParty()) {
    state.party.push(char);
    return 'party';
  }
  if (!Array.isArray(state.roster)) state.roster = [];
  state.roster.push(char);
  return 'roster';
}

function swapInMonster(state, rosterIndex) {
  if (!Array.isArray(state.roster)) return false;
  if (rosterIndex < 0 || rosterIndex >= state.roster.length) return false;

  var target = state.roster[rosterIndex];

  if (!Array.isArray(state.party)) state.party = [];

  if (state.party.length < maxParty()) {
    // 空きあり：単純に party へ移動
    state.roster.splice(rosterIndex, 1);
    state.party.push(target);
    return true;
  }

  // 満杯：party 末尾（slot0 は絶対に動かさない）と入替
  var outgoing = state.party[state.party.length - 1];
  state.party[state.party.length - 1] = target;
  state.roster.splice(rosterIndex, 1);
  state.roster.push(outgoing);
  return true;
}

function sendToRoster(state, partyIndex) {
  if (!Array.isArray(state.party)) return false;
  if (partyIndex === 0) return false;
  if (partyIndex < 0 || partyIndex >= state.party.length) return false;

  var target = state.party.splice(partyIndex, 1)[0];
  if (!Array.isArray(state.roster)) state.roster = [];
  state.roster.push(target);
  return true;
}

// UMD 公開
(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  maxParty:        maxParty,
  enemyToCharacter: enemyToCharacter,
  canScout:        canScout,
  scoutChance:     scoutChance,
  addToRoster:     addToRoster,
  swapInMonster:   swapInMonster,
  sendToRoster:    sendToRoster
});
